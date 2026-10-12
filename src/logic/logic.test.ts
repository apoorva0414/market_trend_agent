import { describe, expect, it } from "vitest";
import type { Client, Holding, TagMove } from "../types";
import { computeExposure, isAffected } from "./exposure";
import { recommendNextStep } from "./nextStep";
import { priorityForRank, scoreExposure } from "./scoring";

const client: Client = {
  id: "c1",
  rmId: "rm1",
  name: "Test Client",
  mandate: "Discretionary",
  riskProfile: "Conservative",
  banks: ["DBS"],
  aumUsd: 10_000_000,
  prefersFrequentUpdates: false,
  lastContactDate: "2026-10-01",
};

function holding(tags: Holding["tags"], marketValueUsd: number, clientId = "c1"): Holding {
  return { clientId, instrument: tags.join("+") || "untagged", assetClass: "Bond", bank: "DBS", currency: "USD", marketValueUsd, costBasisUsd: marketValueUsd, tags };
}

const yields: { id: string; type: "View"; affectedTags: TagMove[] } = {
  id: "t1",
  type: "View",
  affectedTags: [
    { tag: "long-duration-usd-bonds", estMovePct: -3.5 },
    { tag: "reits", estMovePct: -4 },
  ],
};

describe("exposure and impact (6.2)", () => {
  const holdings = [
    holding(["long-duration-usd-bonds"], 2_000_000),
    holding(["reits"], 1_000_000),
    holding(["gold"], 3_000_000),
    holding(["reits"], 5_000_000, "someone-else"),
  ];
  const exposure = computeExposure(client, holdings, yields);

  it("sums only this client's holdings that carry a theme tag", () => {
    expect(exposure.exposureUsd).toBe(3_000_000);
    expect(exposure.exposurePct).toBeCloseTo(0.3);
    expect(exposure.holdings).toHaveLength(2);
  });

  it("applies each tag's own move", () => {
    expect(exposure.estImpactUsd).toBeCloseTo(-70_000 - 40_000);
    expect(exposure.estImpactPct).toBeCloseTo(-0.011);
  });

  it("treats 3% of AUM as the threshold for being affected", () => {
    expect(isAffected(computeExposure(client, [holding(["reits"], 300_000)], yields))).toBe(true);
    expect(isAffected(computeExposure(client, [holding(["reits"], 299_000)], yields))).toBe(false);
  });
});

describe("priority score (6.3)", () => {
  const exposure = computeExposure(client, [holding(["reits"], 2_500_000)], yields); // -1.0% of AUM

  it("multiplies base impact by the risk, mandate, loss and contact weights", () => {
    const stale = scoreExposure({ ...client, lastContactDate: "2026-08-01" }, exposure, "2026-10-12");
    expect(stale).toMatchObject({ riskWeight: 1.3, mandateWeight: 1.2, lossWeight: 1.2, contactBoost: 1.1 });
    expect(stale.base).toBeCloseTo(1.0);
    expect(stale.score).toBeCloseTo(1.0 * 1.3 * 1.2 * 1.2 * 1.1);
  });

  it("gives no contact boost for recent contact, unless the client prefers frequent updates", () => {
    expect(scoreExposure(client, exposure, "2026-10-12").contactBoost).toBe(1.0);
    expect(scoreExposure({ ...client, prefersFrequentUpdates: true }, exposure, "2026-10-12").contactBoost).toBe(1.1);
  });

  it("applies the loss weight only to negative impacts", () => {
    const gain = computeExposure(client, [holding(["energy"], 2_000_000)], { id: "t3", affectedTags: [{ tag: "energy", estMovePct: 5 }] });
    const factors = scoreExposure({ ...client, mandate: "Advisory", riskProfile: "Aggressive" }, gain, "2026-10-12");
    expect(factors.lossWeight).toBe(1.0);
    expect(factors.score).toBeCloseTo(1.0 * 0.9);
  });

  it("splits the ranked list into thirds", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => priorityForRank(i, 6))).toEqual(["High", "High", "Medium", "Medium", "Low", "Low"]);
    expect([0, 1, 2].map((i) => priorityForRank(i, 3))).toEqual(["High", "Medium", "Low"]);
  });
});

describe("recommended next step (6.4), first match wins", () => {
  const tech = {
    id: "t2",
    type: "View" as const,
    affectedTags: [
      { tag: "us-tech", estMovePct: -1.5 },
      { tag: "structured-notes-tech-underlying", estMovePct: -6 },
    ] satisfies TagMove[],
  };

  it("rule 1: concentrated exposure to a falling theme goes to portfolio review", () => {
    const exposure = computeExposure(client, [holding(["reits"], 2_500_000)], yields);
    expect(recommendNextStep(yields, exposure)).toMatchObject({ action: "Portfolio review", rule: 1 });
  });

  it("rule 1 beats rule 2 when a note holder is also concentrated", () => {
    const exposure = computeExposure(client, [holding(["structured-notes-tech-underlying"], 3_000_000)], tech);
    expect(recommendNextStep(tech, exposure).rule).toBe(1);
  });

  it("rule 2: a structured note on tech underlyings is flagged as barrier risk", () => {
    const exposure = computeExposure(client, [holding(["structured-notes-tech-underlying"], 900_000), holding(["us-tech"], 700_000)], tech);
    expect(recommendNextStep(tech, exposure)).toMatchObject({ action: "Talking points", rule: 2, flag: "Barrier risk" });
  });

  it("rule 3: Pulse themes are factual updates", () => {
    const oil = { id: "t3", type: "Pulse" as const, affectedTags: [{ tag: "airlines", estMovePct: -4 }] satisfies TagMove[] };
    const exposure = computeExposure(client, [holding(["airlines"], 800_000)], oil);
    expect(recommendNextStep(oil, exposure)).toMatchObject({ action: "Talking points", rule: 3 });
  });

  it("rule 4: a positive move on a View theme opens a rebalancing conversation", () => {
    const china = { id: "t4", type: "View" as const, affectedTags: [{ tag: "china-equity", estMovePct: 6 }] satisfies TagMove[] };
    const exposure = computeExposure(client, [holding(["china-equity"], 4_000_000)], china);
    expect(recommendNextStep(china, exposure)).toMatchObject({ action: "Talking points", rule: 4 });
  });

  it("rule 5: everything else gets talking points", () => {
    const exposure = computeExposure(client, [holding(["reits"], 1_000_000)], yields);
    expect(recommendNextStep(yields, exposure)).toMatchObject({ action: "Talking points", rule: 5 });
  });
});
