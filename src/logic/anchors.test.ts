import { describe, expect, it } from "vitest";
import { data, DEMO_DATE } from "../data";
import { TAGS } from "../types";
import { runScan } from "./scan";

const scan = (rmId: string, upTo: "morning" | "intraday" = "morning") => runScan({ date: DEMO_DATE, rmId, upTo });

describe("sample data integrity (section 5)", () => {
  it("has 3 RMs with 8 clients each and 6 to 10 positions per client", () => {
    expect(data.rms).toHaveLength(3);
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

  it("uses only the tag vocabulary in holdings, themes, products and the house view", () => {
    const used = [
      ...data.holdings.flatMap((h) => h.tags),
      ...data.themes.flatMap((t) => [...t.affectedTags, ...(t.intradayUpdate?.affectedTags ?? [])].map((a) => a.tag)),
      ...data.products.flatMap((p) => p.tags),
      ...data.houseView.flatMap((h) => h.tags),
    ];
    for (const tag of used) expect(TAGS).toContain(tag);
  });

  it("points every theme at products that exist on the shelf", () => {
    const ids = new Set(data.products.map((p) => p.id));
    for (const theme of data.themes) for (const id of theme.relevantProductIds) expect(ids.has(id), id).toBe(true);
  });
});

describe("scheduled 08:30 scan (6.1)", () => {
  it("reads 12 items from 4 sources, keeps 9 and groups them into 4 themes", () => {
    const { record, themes } = scan("rm-kevin");
    expect(record).toMatchObject({ itemsRead: 12, sourceCount: 4, relevantCount: 9, themeCount: 4, adHoc: null });
    expect(themes.map((t) => t.type)).toEqual(["View", "View", "Pulse", "View"]);
  });

  it("shows prospect themes with a positive move, with China stimulus featured first", () => {
    const { prospectThemes } = scan("rm-kevin");
    expect(prospectThemes.map((p) => p.theme.id)).toEqual(["theme-china-stimulus", "theme-oil-sanctions"]);
    expect(prospectThemes[0].featured).toBe(true);
    expect(prospectThemes[0].products.length).toBeGreaterThan(0);
  });
});

describe("demo anchors for Kevin Tan (5.9)", () => {
  const { clients, clientCount } = scan("rm-kevin");

  it("ranks a Discretionary Conservative bond and REIT heavy client first, for portfolio review", () => {
    const top = clients[0];
    expect(top.client).toMatchObject({ mandate: "Discretionary", riskProfile: "Conservative" });
    expect(top.primary.theme.id).toBe("theme-us-yields");
    expect(top.primary.exposure.exposurePct).toBeGreaterThan(0.33);
    expect(top.primary.exposure.exposurePct).toBeLessThan(0.37);
    expect(new Set(top.primary.exposure.holdings.map((h) => h.tag))).toEqual(new Set(["long-duration-usd-bonds", "reits"]));
    expect(top.primary.nextStep.action).toBe("Portfolio review");
    expect(top.priority).toBe("High");
  });

  it("recommends talking points with a barrier risk flag for the Advisory Growth note holder", () => {
    const row = clients.find((r) => r.primary.nextStep.flag === "Barrier risk");
    expect(row?.client).toMatchObject({ mandate: "Advisory", riskProfile: "Growth" });
    expect(row?.primary.nextStep.action).toBe("Talking points");
    expect(row?.primary.exposure.holdings.some((h) => h.holding.barrierDistancePct !== undefined)).toBe(true);
  });

  it("includes the family account, with its note", () => {
    const family = clients.find((r) => r.client.notes?.startsWith("Family account"));
    expect(family).toBeDefined();
  });

  it("leaves at least one client out of the list as unaffected", () => {
    expect(clients).toHaveLength(6);
    expect(clientCount - clients.length).toBeGreaterThanOrEqual(1);
  });
});

describe("other RMs (5.9)", () => {
  it("gives Sarah Lim and Daniel Wong 3 to 6 affected clients each, with different lists", () => {
    const sarah = scan("rm-sarah").clients;
    const daniel = scan("rm-daniel").clients;
    for (const list of [sarah, daniel]) {
      expect(list.length).toBeGreaterThanOrEqual(3);
      expect(list.length).toBeLessThanOrEqual(6);
    }
    expect(sarah.map((r) => r.client.id)).not.toEqual(daniel.map((r) => r.client.id));
    expect(sarah.every((r) => r.client.rmId === "rm-sarah")).toBe(true);
  });
});

describe("ad hoc Scan now (6.1)", () => {
  const morning = scan("rm-kevin");
  const intraday = scan("rm-kevin", "intraday");

  it("picks up the 2 intraday items and adds a fifth Pulse theme", () => {
    expect(intraday.record.adHoc).toMatchObject({ newItems: 2, newThemes: 1, updatedThemes: 1, themeCount: 5 });
    const added = intraday.themes.find((t) => t.status === "new");
    expect(added).toMatchObject({ id: "theme-perp-call", type: "Pulse" });
    expect(intraday.record.itemsRead).toBe(12); // the scheduled record is unchanged
  });

  it("raises the energy and airline moves on the oil theme", () => {
    const move = (s: typeof morning, tag: string) =>
      s.themes.find((t) => t.id === "theme-oil-sanctions")!.affectedTags.find((a) => a.tag === tag)!.estMovePct;
    expect(move(intraday, "energy")).toBeGreaterThan(move(morning, "energy"));
    expect(move(intraday, "airlines")).toBeLessThan(move(morning, "airlines"));
    expect(intraday.themes.find((t) => t.id === "theme-oil-sanctions")!.status).toBe("updated");
  });

  it("brings in one or two of Kevin's clients who hold the called bond", () => {
    const holders = intraday.clients.filter((r) => [r.primary, ...r.others].some((a) => a.theme.id === "theme-perp-call"));
    expect(holders.length).toBeGreaterThanOrEqual(1);
    expect(holders.length).toBeLessThanOrEqual(2);
    expect(intraday.clients.filter((r) => r.change?.isNew)).toHaveLength(1);
    expect(intraday.clients.length).toBe(morning.clients.length + 1);
  });

  it("re-ranks clients and marks what changed, while #1 stays put", () => {
    expect(intraday.clients[0].client.id).toBe(morning.clients[0].client.id);
    expect(intraday.clients[0].change).toBeNull();
    expect(intraday.clients.some((r) => (r.change?.rankDelta ?? 0) > 0)).toBe(true);
    expect(intraday.clients.some((r) => (r.change?.rankDelta ?? 0) < 0)).toBe(true);
  });

  it("is a pure function: the morning result is unchanged by an intraday run", () => {
    expect(scan("rm-kevin")).toEqual(morning);
  });
});
