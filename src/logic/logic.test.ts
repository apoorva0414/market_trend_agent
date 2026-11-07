import { describe, expect, it } from "vitest";
import type { Client, Holding, TagMove } from "../types";
import { computeExposure, isAffected } from "./exposure";
import { barrierFlag } from "./flags";
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
  nextReviewDate: "2027-01-15",
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

describe("barrier risk flag", () => {
  const tech = {
    affectedTags: [
      { tag: "us-tech", estMovePct: -1.5 },
      { tag: "structured-notes-tech-underlying", estMovePct: -6 },
    ] satisfies TagMove[],
  };

  it("is set when the theme moves tech structured notes and the client holds one", () => {
    const exposure = computeExposure(client, [holding(["structured-notes-tech-underlying"], 900_000)], { id: "t2", ...tech });
    expect(barrierFlag(tech, exposure)).toBe("Barrier risk");
  });

  it("is not set otherwise", () => {
    const exposure = computeExposure(client, [holding(["us-tech"], 900_000)], { id: "t2", ...tech });
    expect(barrierFlag(tech, exposure)).toBeUndefined();
    expect(barrierFlag(yields, computeExposure(client, [holding(["reits"], 900_000)], yields))).toBeUndefined();
  });
});
