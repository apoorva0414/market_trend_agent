import { describe, expect, it } from "vitest";
import { data, DEMO_DATE } from "../data";
import { buildRefineContext, buildTalkingPoints } from "../documents/talkingPoints";
import { runScan } from "../logic/scan";
import {
  allowedNumbers,
  asksForPromisedReturn,
  enforceLockedFigures,
  extractNumbers,
  FIGURES_NOTICE,
} from "./lockedFacts";

const rm = data.rms[0];
const ctx = { rm, date: DEMO_DATE };
const scan = runScan({ date: DEMO_DATE, rmId: rm.id, upTo: "morning" });
const row = scan.clients.find((r) => r.primary.nextStep.flag === "Barrier risk")!; // Rajesh Menon
const doc = buildTalkingPoints(row, ctx);
const context = buildRefineContext(row, doc, ctx);
const current = doc.wording;
const allowed = allowedNumbers({ ...context, currentDoc: { ...current, disclaimer: doc.disclaimer } });

describe("extractNumbers", () => {
  it("normalises separators, trailing zeros and full-width digits", () => {
    expect(extractNumbers("USD 1,500.0 and 4.0% and ２０％")).toEqual(["1500", "4", "20"]);
    expect(extractNumbers("−USD 64.5k (−0.81% of the total)")).toEqual(["64.5", "0.81"]);
    expect(extractNumbers("no figures here")).toEqual([]);
  });
});

describe("locked figures (1.3)", () => {
  it("accepts every figure that is in the generated draft and the holdings table", () => {
    const { rejectedFields } = enforceLockedFigures(current, current, allowed);
    expect(rejectedFields).toEqual([]);
    for (const holding of context.factsLocked.holdings) {
      for (const number of extractNumbers(`${holding.value} ${holding.estImpact} ${holding.estMove}`)) expect(allowed.has(number)).toBe(true);
    }
  });

  it("accepts a rewrite that reuses source figures exactly", () => {
    const proposed = {
      ...current,
      summary: "Technology bonds and shares fell last week. We estimate an effect of about −USD 64.5k (−0.81% of the total) on your holdings.",
    };
    const result = enforceLockedFigures(current, proposed, allowed);
    expect(result.rejectedFields).toEqual([]);
    expect(result.wording.summary).toBe(proposed.summary);
  });

  it("rejects a field with an invented number and keeps the previous text for that field only", () => {
    const proposed = {
      summary: "Technology shares slipped. We expect the note to gain 37% by year end.",
      talkingPoints: ["The holdings concerned make up about 20% of your portfolio."],
      nextSteps: ["We suggest a short call within 48 hours."],
    };
    const result = enforceLockedFigures(current, proposed, allowed);
    expect(result.rejectedFields).toEqual(["summary", "nextSteps"]);
    expect(result.wording.summary).toBe(current.summary);
    expect(result.wording.nextSteps).toEqual(current.nextSteps);
    expect(result.wording.talkingPoints).toEqual(proposed.talkingPoints); // this field used only source figures
  });

  it("rejects rounded or converted amounts, since they are not in the source data", () => {
    const rounded = { ...current, summary: "We estimate an effect of about −USD 65k on the holdings concerned." };
    expect(enforceLockedFigures(current, rounded, allowed).rejectedFields).toEqual(["summary"]);
    const converted = { ...current, summary: "我们估计相关持仓受到的影响约为6.45万美元。" };
    expect(enforceLockedFigures(current, converted, allowed).rejectedFields).toEqual(["summary"]);
  });

  it("lets a date keep its meaning when the month is written as a number", () => {
    // "Last spoke on 2 October" may be written 10月2日 in Mandarin.
    expect(context.factsLocked.lastContact.spoken).toBe("2 October");
    const zh = { ...current, summary: "自我们10月2日上次联系以来，有一项进展。" };
    expect(enforceLockedFigures(current, zh, allowed).rejectedFields).toEqual([]);
    expect(allowed.has("3")).toBe(false); // "market" must not count as March
  });

  it("has a fixed notice to show when figures were kept", () => {
    expect(FIGURES_NOTICE).toBe("Kept the original figures. Numbers come from the portfolio data.");
  });
});

describe("instructions that ask for a promised return", () => {
  it("catches the demo line even though 20% appears in this client's data", () => {
    expect(allowed.has("20")).toBe(true);
    expect(asksForPromisedReturn("say the note will gain 20%")).toBe(true);
  });

  it("catches guarantees and forecasts with figures", () => {
    expect(asksForPromisedReturn("Tell him it is guaranteed to recover")).toBe(true);
    expect(asksForPromisedReturn("mention the fund should return 8% a year")).toBe(true);
    expect(asksForPromisedReturn("say this is risk-free")).toBe(true);
  });

  it("lets ordinary editing requests through", () => {
    expect(asksForPromisedReturn("I agree, but the client is nervous; keep it calm.")).toBe(false);
    expect(asksForPromisedReturn("Say we will return to this next week")).toBe(false);
    expect(asksForPromisedReturn("Shorten to 3 points")).toBe(false);
    expect(asksForPromisedReturn("Mention that I will call on Thursday")).toBe(false);
  });
});
