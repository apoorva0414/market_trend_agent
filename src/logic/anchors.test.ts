import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { data, DEMO_DATE, DEMO_NOW } from "../data";
import { TAGS } from "../types";
import { bookStateAt } from "./book";
import { runDailyBrief } from "./brief";
import { simulateMonitor } from "./monitor";

const day = (rmId: string, until = "23:59") => simulateMonitor({ date: DEMO_DATE, rmId, until });
const clientNamed = (name: string) => data.clients.find((c) => c.name === name)!;
const resultFor = (rmId: string, itemId: string) => day(rmId).evaluations.find((e) => e.itemId === itemId);

describe("sample data integrity", () => {
  it("has 2 RMs (one Dedicated ARM, one Central ARM) with 8 clients each and 6 to 10 positions per client", () => {
    expect(data.rms).toHaveLength(2);
    expect(data.rms.map((r) => r.arm_model).sort()).toEqual(["Central ARM", "Dedicated ARM"]);
    for (const rm of data.rms) expect(data.clients.filter((c) => c.rmId === rm.id)).toHaveLength(8);
    for (const client of data.clients) {
      const count = data.holdings.filter((h) => h.clientId === client.id).length;
      expect(count, client.name).toBeGreaterThanOrEqual(6);
      expect(count, client.name).toBeLessThanOrEqual(10);
    }
  });

  it("keeps AUM between USD 2m and 60m and equal to the sum of holdings", () => {
    for (const client of data.clients) {
      const total = data.holdings.filter((h) => h.clientId === client.id).reduce((sum, h) => sum + h.marketValueUsd, 0);
      expect(client.aumUsd, client.name).toBe(total);
      expect(client.aumUsd).toBeGreaterThanOrEqual(2_000_000);
      expect(client.aumUsd).toBeLessThanOrEqual(60_000_000);
    }
  });

  it("uses only the tag vocabulary", () => {
    const used = [
      ...data.holdings.flatMap((h) => h.tags),
      ...data.themes.flatMap((t) => [...t.affectedTags, ...(t.intradayUpdate?.affectedTags ?? [])].map((a) => a.tag)),
      ...data.positionEvents.flatMap((e) => e.narrative?.affectedTags.map((a) => a.tag) ?? []),
      ...data.houseView.flatMap((h) => h.tags),
    ];
    for (const tag of used) expect(TAGS).toContain(tag);
  });

  it("names position event instruments exactly as in holdings", () => {
    const instruments = new Set(data.holdings.map((h) => h.instrument));
    for (const event of data.positionEvents) expect(instruments.has(event.instrument), event.instrument).toBe(true);
  });

  it("schedules every client's review between November 2026 and April 2027", () => {
    for (const client of data.clients) expect(client.nextReviewDate >= "2026-11-01" && client.nextReviewDate <= "2027-04-30", client.name).toBe(true);
  });

  it("spreads morning items over the night and early morning, and keeps intraday items between 13:00 and 14:00", () => {
    for (const item of [...data.news, ...data.positionEvents]) {
      const time = item.publishedAt.slice(11, 16);
      if (item.batch === "morning") expect(time >= "05:50" && time <= "08:15", item.id).toBe(true);
      else expect(time >= "13:00" && time <= "14:00", item.id).toBe(true);
    }
  });

  it("keeps no schedule or interval config for alerts", () => {
    const config = readFileSync(new URL("../config/alertRules.ts", import.meta.url), "utf8");
    expect(config).not.toMatch(/schedule|interval|cron|every \d+/i);
  });
});

describe("daily brief job (update 3, 1.1)", () => {
  it("reads the morning batch only and orders themes by relevance to the RM's book", () => {
    const brief = runDailyBrief({ date: DEMO_DATE, rmId: "rm-kevin" });
    expect(brief).toMatchObject({ generatedAt: "08:30", deliveredAt: "09:00" });
    expect(brief.themes).toHaveLength(4);
    expect(brief.themes[0]).toMatchObject({ clientsExposed: 6, assetTypes: "long-duration USD bonds, REITs or short-duration bonds" });
    expect(brief.themes.find((t) => t.theme.id === "theme-oil-sanctions")?.theme.status).toBe("unchanged"); // the 13:05 widening is not in the brief
    expect(brief.events.map((e) => [e.event.eventType, e.holders])).toEqual([["Barrier proximity", 1]]);
  });
});

describe("demo anchors (update 3, section 5)", () => {
  it("Kevin Tan: a 06:41 Client Alert with the bond/REIT client (rule A) and the structured-note client (barrier event)", () => {
    const { alerts } = day("rm-kevin", "09:05");
    expect(alerts).toHaveLength(1);
    const [alert] = alerts;
    expect(alert.time).toBe("06:41");
    expect(alert.itemIds.sort()).toEqual(["n02", "pe-barrier-tech-note"]);
    expect(alert.triggers.map((t) => [t.clientId, t.kind])).toEqual([
      [clientNamed("Eleanor Chua").id, "material-impact"],
      [clientNamed("Rajesh Menon").id, "position-event"],
    ]);
  });

  it("Kevin Tan: the later rates items and the family account send nothing", () => {
    expect(resultFor("rm-kevin", "n05")?.alertId).toBeUndefined();
    expect(resultFor("rm-kevin", "n08")?.alertId).toBeUndefined();
    const family = data.clients.find((c) => c.notes?.startsWith("Family account"))!;
    expect(day("rm-kevin").alerts.flatMap((a) => a.triggers.map((t) => t.clientId))).not.toContain(family.id);
  });

  it("Kevin Tan, next items: oil at 13:05 sends nothing, the call notice at 13:20 alerts 1 new client", () => {
    expect(resultFor("rm-kevin", "n13")).toMatchObject({ evaluatedAt: "2026-10-12T13:05:00+08:00" });
    expect(resultFor("rm-kevin", "n13")?.alertId).toBeUndefined();
    const update = day("rm-kevin").alerts[1];
    expect(update).toMatchObject({ time: "13:21" });
    expect(update.triggers.map((t) => [t.clientId, t.reason])).toEqual([[clientNamed("Victor Ong").id, "Call notice on Partner Bank A 5.875% USD Perpetual"]]);
    expect(day("rm-kevin").alerts).toHaveLength(2);
  });

  it("Sarah Lim: only the brief; every item, including the intraday ones, needs no alert", () => {
    const { alerts, evaluations } = day("rm-sarah");
    expect(alerts).toEqual([]);
    expect(evaluations.length).toBe(16);
    expect(evaluations.every((e) => !e.alertId)).toBe(true);
    expect(runDailyBrief({ date: DEMO_DATE, rmId: "rm-sarah" }).clientsExposed).toBeGreaterThan(0);
  });

  it("by 14:00 (the demo's current time) both of Kevin's alerts are in, including the 13:21 call notice", () => {
    expect(day("rm-kevin", DEMO_NOW).alerts.map((a) => a.time)).toEqual(["06:41", "13:21"]);
    expect(day("rm-kevin", "09:05").evaluations).toHaveLength(13);
  });

  it("is pure: the book at one time is unchanged by looking at another", () => {
    const before = bookStateAt({ date: DEMO_DATE, rmId: "rm-kevin", at: "08:30" });
    bookStateAt({ date: DEMO_DATE, rmId: "rm-kevin", at: "23:59" });
    expect(bookStateAt({ date: DEMO_DATE, rmId: "rm-kevin", at: "08:30" })).toEqual(before);
  });
});
