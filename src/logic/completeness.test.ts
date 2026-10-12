import { describe, expect, it } from "vitest";
import { data, DEMO_DATE } from "../data";
import { checkPortfolioReview, checkProposal, CONTEXT_CHIPS, gapSummary } from "./completeness";

const ids = (gaps: { id: string }[]) => gaps.map((gap) => gap.id);
const eleanor = data.clients.find((c) => c.name === "Eleanor Chua")!;
const family = data.clients.find((c) => c.notes?.startsWith("Family account"))!;

describe("Check completeness: Portfolio Review rules (2.2)", () => {
  const simple = { banks: ["DBS"], lastContactDate: "2026-10-01" };

  it("flags an empty RM context", () => {
    expect(ids(checkPortfolioReview(simple, "   ", DEMO_DATE))).toEqual(["context"]);
    expect(checkPortfolioReview(simple, "Client is travelling until Friday.", DEMO_DATE)).toEqual([]);
  });

  it("flags last contact over 90 days ago and asks to confirm the risk profile", () => {
    const stale = { banks: ["DBS"], lastContactDate: "2026-07-13" }; // 91 days before the demo date
    const gaps = checkPortfolioReview(stale, "Some context.", DEMO_DATE);
    expect(ids(gaps)).toEqual(["risk-profile"]);
    expect(gaps[0].message).toBe("Last contact was 91 days ago. Confirm the risk profile is still current.");
    expect(checkPortfolioReview({ ...stale, lastContactDate: "2026-07-14" }, "Some context.", DEMO_DATE)).toEqual([]); // exactly 90 days
  });

  it("flags a family-account note", () => {
    expect(ids(checkPortfolioReview({ ...simple, notes: family.notes }, "Some context.", DEMO_DATE))).toEqual(["family"]);
    expect(ids(checkPortfolioReview({ ...simple, notes: "Prefers email." }, "Some context.", DEMO_DATE))).toEqual([]);
  });

  it("flags multiple banks and reminds the RM to confirm holdings are complete", () => {
    const gaps = checkPortfolioReview({ ...simple, banks: ["DBS", "UBS"] }, "Some context.", DEMO_DATE);
    expect(ids(gaps)).toEqual(["banks"]);
    expect(gaps[0].message).toContain("DBS and UBS");
  });

  it("finds 3 gaps for the demo client with no context, and 2 after one context chip", () => {
    expect(ids(checkPortfolioReview(eleanor, "", DEMO_DATE))).toEqual(["context", "risk-profile", "banks"]);
    const chip = CONTEXT_CHIPS["portfolio-review"][1].starter;
    const gaps = checkPortfolioReview(eleanor, chip, DEMO_DATE);
    expect(ids(gaps)).toEqual(["risk-profile", "banks"]);
    expect(gapSummary(gaps)).toBe("sent with 2 open gaps");
  });

  it("does not close a gap on the bare starter sentence, only once the RM completes it", () => {
    const [risk, banks] = checkPortfolioReview(eleanor, "x", DEMO_DATE);
    expect(ids(checkPortfolioReview(eleanor, `${risk.starter}\n${banks.starter}`, DEMO_DATE))).toEqual(["risk-profile", "banks"]);
    const completed = `${risk.starter}unchanged, confirmed by phone.\n${banks.starter}complete.`;
    expect(checkPortfolioReview(eleanor, completed, DEMO_DATE)).toEqual([]);
    expect(gapSummary([])).toBe("sent with no open gaps");
  });

  it("closes the family gap when the RM says who decides", () => {
    const starter = CONTEXT_CHIPS["portfolio-review"][2].starter;
    expect(ids(checkPortfolioReview(family, starter, DEMO_DATE))).toContain("family");
    expect(ids(checkPortfolioReview(family, `${starter}Mr Lim, the father.`, DEMO_DATE))).not.toContain("family");
  });
});

describe("Check completeness: Proposal rules (2.2)", () => {
  const full =
    "Tech founder in her forties, about SGD 10m to invest after an exit, growth-oriented with a ten-year horizon. Prospect introduced by an existing client, Mr Koh.";

  it("is ready to hand off when nothing is missing", () => {
    expect(checkProposal(full, "")).toEqual([]);
  });

  it("flags a profile with no budget or amount", () => {
    expect(ids(checkProposal(full.replace("about SGD 10m to invest", "money to invest"), ""))).toEqual(["budget"]);
    expect(ids(checkProposal(full.replace("SGD 10m", "S$2.5 million"), ""))).toEqual([]);
  });

  it("flags a missing risk appetite", () => {
    expect(ids(checkProposal(full.replace("growth-oriented", "patient"), ""))).toEqual(["risk"]);
  });

  it("flags a missing introduced-by, and is not satisfied by the bare chip text", () => {
    const withoutIntro = full.replace(" Prospect introduced by an existing client, Mr Koh.", "");
    expect(ids(checkProposal(withoutIntro, ""))).toEqual(["introduced"]);
    expect(ids(checkProposal(withoutIntro, CONTEXT_CHIPS.proposal[0].starter))).toEqual(["introduced"]);
    expect(checkProposal(withoutIntro, "Prospect introduced by his lawyer.")).toEqual([]);
  });

  it("flags a description under 10 words", () => {
    const gaps = checkProposal("Tech founder, SGD 10m, growth", "");
    expect(ids(gaps)).toEqual(["introduced", "profile"]);
    expect(gaps[1].message).toContain("only 5 words");
    expect(gapSummary(gaps)).toBe("sent with 2 open gaps");
  });

  it("counts context the RM adds on the Act page towards the description", () => {
    const context = "Prospect introduced by Marcus Koh at the family office dinner last month.";
    expect(checkProposal("Tech founder, SGD 10m, growth", context)).toEqual([]);
  });

  it("flags everything for an empty profile", () => {
    expect(ids(checkProposal("", ""))).toEqual(["budget", "risk", "introduced", "profile"]);
    expect(gapSummary(checkProposal("x", "").slice(0, 1))).toBe("sent with 1 open gap");
  });
});
