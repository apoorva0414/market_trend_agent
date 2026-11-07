import { describe, expect, it } from "vitest";
import { alertRules, howAlertsWork } from "../config/alertRules";
import { type DataSet } from "../data";
import type { Client, Holding, MonitorItem, PositionEvent, Tag, Theme } from "../types";
import { evaluateAlerts } from "./alerts";
import { bookStateAt } from "./book";
import { runDailyBrief } from "./brief";
import { evaluateIncomingItem, monitorItems, simulateMonitor } from "./monitor";

// A tiny portfolio world, so each condition can be tested exactly at its threshold.
const DATE = "2026-10-12";
const client = (id: string, aum = 10_000_000): Client => ({
  id,
  rmId: "rm-test",
  name: id,
  mandate: "Advisory",
  riskProfile: "Balanced",
  banks: ["DBS"],
  aumUsd: aum,
  prefersFrequentUpdates: false,
  lastContactDate: "2026-10-01",
  nextReviewDate: "2027-01-15",
});
const holding = (clientId: string, tag: Tag | null, value: number, instrument = `${clientId}-${tag}`): Holding => ({
  clientId,
  instrument,
  assetClass: "Bond",
  bank: "DBS",
  currency: "USD",
  marketValueUsd: value,
  costBasisUsd: value,
  tags: tag ? [tag] : [],
});
const theme = (id: string, moves: [Tag, number][]): Theme => ({
  id,
  title: `Theme ${id}`,
  shortTitle: id,
  type: "View",
  alertCause: `cause ${id}`,
  briefTone: "t",
  briefHeadline: "h",
  briefMention: "m",
  whatHappened: "x",
  whyItMatters: "y",
  affectedTags: moves.map(([tag, estMovePct]) => ({ tag, estMovePct })),
  clientSummary: "s",
  clientTalkingPoint: "p",
});

function world(clients: Client[], holdings: Holding[], themes: Theme[], events: PositionEvent[] = [], newsTime = "07:00"): DataSet {
  // Pad each client with untagged cash so AUM equals the sum of holdings.
  const padded = clients.flatMap((c) => {
    const used = holdings.filter((h) => h.clientId === c.id).reduce((s, h) => s + h.marketValueUsd, 0);
    return [...holdings.filter((h) => h.clientId === c.id), holding(c.id, null, c.aumUsd - used, `${c.id}-cash`)];
  });
  return {
    rms: [{ id: "rm-test", name: "Test RM", arm_model: "Central ARM" }],
    clients,
    holdings: padded,
    news: themes.map((t, i) => ({ id: `n${i}`, source: "Wire", publishedAt: `${DATE}T${newsTime}:00+08:00`, headline: t.title, summary: "", themeId: t.id, relevant: true, batch: "morning" as const })),
    themes,
    positionEvents: events,
    houseView: [],
  };
}

/** Everything in the world has arrived; position events count as arriving now. */
function alertsIn(dataSet: DataSet, rules = alertRules) {
  const state = bookStateAt({ date: DATE, rmId: "rm-test", at: "23:59" }, dataSet);
  return evaluateAlerts({ state, eventIds: dataSet.positionEvents.map((e) => e.id), rmId: "rm-test", alreadyAlerted: [], rules, dataSet });
}

describe("rule A: material estimated impact", () => {
  it("fires at exactly −1.0% of AUM and not at −0.99%", () => {
    // 4,000,000 × −2.5% = −100,000 = −1.0% of 10m. 3,960,000 × −2.5% = −0.99%.
    const t = theme("a", [["reits", -2.5]]);
    const at = alertsIn(world([client("c1")], [holding("c1", "reits", 4_000_000)], [t]));
    expect(at).toHaveLength(1);
    expect(at[0]).toMatchObject({ kind: "material-impact", reason: "Estimated impact −1.0% of AUM from Theme a (alert threshold −1.0%)" });
    expect(alertsIn(world([client("c1")], [holding("c1", "reits", 3_960_000)], [t]))).toEqual([]);
  });
});

describe("rule B: concentrated exposure to a sharp move", () => {
  const t = theme("b", [["airlines", -3]]);

  it("fires at exactly 10% exposure with a −3% move", () => {
    const at = alertsIn(world([client("c1")], [holding("c1", "airlines", 1_000_000)], [t]));
    expect(at).toHaveLength(1);
    expect(at[0]).toMatchObject({ kind: "concentrated-exposure", reason: "10% of AUM exposed to Theme b, move −3% (alert threshold: 10% exposure and −3% move)" });
  });

  it("does not fire just below 10% exposure", () => {
    expect(alertsIn(world([client("c1")], [holding("c1", "airlines", 999_000)], [t]))).toEqual([]);
  });

  it("does not fire when the move is milder than −3%", () => {
    const mild = theme("b2", [["airlines", -2.9]]);
    expect(alertsIn(world([client("c1")], [holding("c1", "airlines", 3_000_000)], [mild]))).toEqual([]);
  });

  it("judges each tag on its own: a large exposure to a mild move does not count", () => {
    const mixed = theme("b3", [["long-duration-usd-bonds", -3.5], ["short-duration-bonds", -0.5]]);
    const holdings = [holding("c1", "long-duration-usd-bonds", 600_000), holding("c1", "short-duration-bonds", 3_000_000)];
    expect(alertsIn(world([client("c1")], holdings, [mixed]))).toEqual([]);
  });
});

describe("losses only", () => {
  const gain = theme("g", [["china-equity", 6]]);
  const big = [holding("c1", "china-equity", 5_000_000)]; // +3% of AUM, 50% exposure

  it("never alerts on gains while includeGains is false", () => {
    expect(alertRules.includeGains).toBe(false);
    expect(alertsIn(world([client("c1")], big, [gain]))).toEqual([]);
  });

  it("would alert on the same gain if includeGains were turned on", () => {
    expect(alertsIn(world([client("c1")], big, [gain]), { ...alertRules, includeGains: true })).toHaveLength(1);
  });
});

describe("position events", () => {
  const event = (batch: "morning" | "intraday"): PositionEvent => ({
    id: `e-${batch}`,
    batch,
    eventType: "Downgrade",
    instrument: "Tiny Bond 2030",
    headline: "Downgraded",
    description: "Downgraded to BB.",
    publishedAt: `${DATE}T${batch === "morning" ? "07" : "13"}:00:00+08:00`,
  });

  it("always alert a client who holds the instrument, however small the position", () => {
    const dataSet = world([client("c1"), client("c2")], [holding("c1", null, 10_000, "Tiny Bond 2030")], [], [event("morning")]);
    const triggers = alertsIn(dataSet);
    expect(triggers).toEqual([expect.objectContaining({ clientId: "c1", kind: "position-event", reason: "Downgrade on Tiny Bond 2030", whyClient: "Holds the bond that was downgraded" })]);
  });

  it("take priority over A and B when several conditions hold", () => {
    const t = theme("a", [["reits", -5]]);
    const dataSet = world([client("c1")], [holding("c1", "reits", 3_000_000, "Tiny Bond 2030")], [t], [event("morning")]);
    const [trigger] = alertsIn(dataSet);
    expect(trigger.kind).toBe("position-event");
    expect(trigger.covers.sort()).toEqual(["a", "e-morning"]);
  });

  it("only count when they arrive, not when they are merely known", () => {
    const dataSet = world([client("c1")], [holding("c1", null, 10_000, "Tiny Bond 2030")], [], [event("morning")]);
    const state = bookStateAt({ date: DATE, rmId: "rm-test", at: "23:59" }, dataSet);
    expect(evaluateAlerts({ state, eventIds: [], rmId: "rm-test", alreadyAlerted: [], dataSet })).toEqual([]);
  });
});

describe("alert monitor (update 3, 1.2)", () => {
  const t = theme("a", [["reits", -5]]);
  const call: PositionEvent = {
    id: "e1",
    batch: "intraday",
    eventType: "Call notice",
    instrument: "Callable Bond",
    headline: "Called",
    description: "Called at par.",
    publishedAt: `${DATE}T13:30:00+08:00`,
  };
  const item = (dataSet: DataSet, id: string): MonitorItem => monitorItems(DATE, dataSet).find((i) => i.id === id)!;

  it("sends an alert when an item makes a client newly meet the rule, a minute after it arrives", () => {
    const dataSet = world([client("c1")], [holding("c1", "reits", 3_000_000)], [t], [], "06:40");
    const alert = evaluateIncomingItem({ date: DATE, rmId: "rm-test", item: item(dataSet, "n0"), alreadyAlerted: [], dataSet });
    expect(alert).toMatchObject({ time: "06:41", detectedAt: `${DATE}T06:41:00+08:00`, itemIds: ["n0"], id: "A-20261012-test-0641" });
    expect(alert?.triggers.map((x) => x.clientId)).toEqual(["c1"]);
  });

  it("sends nothing when no client meets the rule", () => {
    const dataSet = world([client("c1")], [holding("c1", "reits", 100_000)], [t]);
    expect(evaluateIncomingItem({ date: DATE, rmId: "rm-test", item: item(dataSet, "n0"), alreadyAlerted: [], dataSet })).toBeNull();
  });

  it("sends nothing for an item that only repeats what was already alerted", () => {
    const dataSet = world([client("c1")], [holding("c1", "reits", 3_000_000)], [t]);
    const first = evaluateIncomingItem({ date: DATE, rmId: "rm-test", item: item(dataSet, "n0"), alreadyAlerted: [], dataSet })!;
    expect(evaluateIncomingItem({ date: DATE, rmId: "rm-test", item: item(dataSet, "n0"), alreadyAlerted: first.triggers, dataSet })).toBeNull();
  });

  it("evaluates items arriving at the same moment together and sends at most one email", () => {
    const sameTime = { ...call, publishedAt: `${DATE}T07:00:00+08:00` };
    const dataSet = world([client("c1"), client("c2")], [holding("c1", "reits", 3_000_000), holding("c2", null, 100_000, "Callable Bond")], [t], [sameTime]);
    const { alerts, evaluations } = simulateMonitor({ date: DATE, rmId: "rm-test", until: "23:59" }, alertRules, dataSet);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].itemIds.sort()).toEqual(["e1", "n0"]);
    expect(alerts[0].triggers.map((x) => x.clientId).sort()).toEqual(["c1", "c2"]);
    expect(evaluations.every((e) => e.alertId === alerts[0].id)).toBe(true);
  });

  it("deduplicates across items: a second item on the same theme does not alert the same client again", () => {
    const dataSet = world([client("c1")], [holding("c1", "reits", 3_000_000)], [t]);
    dataSet.news.push({ ...dataSet.news[0], id: "n0b", publishedAt: `${DATE}T07:30:00+08:00` });
    const { alerts, evaluations } = simulateMonitor({ date: DATE, rmId: "rm-test", until: "23:59" }, alertRules, dataSet);
    expect(alerts).toHaveLength(1);
    expect(evaluations.map((e) => [e.itemId, Boolean(e.alertId)])).toEqual([["n0", true], ["n0b", false]]);
  });

  it("only alerts the newly affected client when a later item arrives", () => {
    const dataSet = world([client("c1"), client("c2")], [holding("c1", "reits", 3_000_000), holding("c2", null, 100_000, "Callable Bond")], [t], [call]);
    const { alerts } = simulateMonitor({ date: DATE, rmId: "rm-test", until: "23:59" }, alertRules, dataSet);
    expect(alerts.map((a) => [a.time, a.triggers.map((x) => x.clientId)])).toEqual([["07:01", ["c1"]], ["13:31", ["c2"]]]);
    expect(simulateMonitor({ date: DATE, rmId: "rm-test", until: "09:05" }, alertRules, dataSet).alerts).toHaveLength(1);
  });

  it("never lets the daily brief job create alerts", () => {
    const dataSet = world([client("c1")], [holding("c1", "reits", 3_000_000)], [t]);
    const brief = runDailyBrief({ date: DATE, rmId: "rm-test" }, dataSet);
    expect(brief).not.toHaveProperty("alerts");
    expect(brief).not.toHaveProperty("triggers");
    expect(Object.keys(brief).sort()).toEqual(["clientsExposed", "date", "deliveredAt", "events", "generatedAt", "houseView", "rmId", "themes"]);
  });
});

describe("How alerts work", () => {
  it("is generated from the values in alertRules.ts", () => {
    expect(howAlertsWork()).toBe(
      "You get an alert email when something on a client's specific holding happens (for example a call notice, downgrade or barrier risk), or when today's news is estimated to cost a client 1% or more of their portfolio, or hits 10% or more of their portfolio with a move of 3% or more. These are starting values and will be adjusted based on your feedback.",
    );
    expect(howAlertsWork({ ...alertRules, impactPctThreshold: -1.5, exposurePctThreshold: 12 })).toContain("1.5% or more of their portfolio, or hits 12% or more");
  });
});
