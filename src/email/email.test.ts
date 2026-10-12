import { describe, expect, it } from "vitest";
import { data, DEMO_DATE } from "../data";
import { runScan } from "../logic/scan";
import { buildEmailModel, renderEmailBody, renderEmailDocument } from "./template";

describe("9 AM email (7.2)", () => {
  const rm = data.rms[0];
  const scan = runScan({ date: DEMO_DATE, rmId: rm.id, upTo: "morning" });
  const model = buildEmailModel(scan, rm);
  const body = renderEmailBody(model, { briefUrl: "#/brief", logoUrl: null });

  it("uses the subject line from the spec for Kevin Tan", () => {
    expect(model.subject).toBe("Daily Market Brief, Mon 12 Oct: 4 themes, 6 clients to review");
    expect(model).toMatchObject({ to: "Kevin Tan", time: "09:00 SGT", firstName: "Kevin" });
  });

  it("lists every theme and the top 3 clients by name and priority", () => {
    for (const theme of scan.themes) expect(body).toContain(theme.title);
    expect(model.topClients.map((c) => c.name)).toEqual(scan.clients.slice(0, 3).map((r) => r.client.name));
    expect(body).toContain("1 prospect theme worth exploring");
    expect(body).toContain("Open brief");
  });

  it("contains no holdings, amounts or impacts", () => {
    const visibleText = body.replace(/<[^>]+>/g, " ");
    expect(visibleText).not.toMatch(/USD|SGD|%|\d+(\.\d+)?\s?(m|k)\b/);
    for (const holding of data.holdings) expect(visibleText).not.toContain(holding.instrument);
  });

  it("changes with the RM and links the standalone export to that RM's brief", () => {
    const sarah = data.rms[1];
    const other = buildEmailModel(runScan({ date: DEMO_DATE, rmId: sarah.id, upTo: "morning" }), sarah);
    expect(other.topClients).not.toEqual(model.topClients);
    const html = renderEmailDocument(other, { briefUrl: "http://localhost:5173/#/brief?rm=rm-sarah", logoUrl: null });
    expect(html).toContain('href="http://localhost:5173/#/brief?rm=rm-sarah"');
    expect(html).toContain("Prototype with sample data");
  });
});

describe("email branding (update 4)", () => {
  const rm = data.rms[0];
  const model = buildEmailModel(runScan({ date: DEMO_DATE, rmId: rm.id, upTo: "morning" }), rm);

  it("uses the dark Azimut styling, with Azimut blue on the Open brief button", () => {
    const html = renderEmailDocument(model, { briefUrl: "#/brief", logoUrl: null });
    expect(html).toContain("background:#0d1520");
    expect(html).toMatch(/<a data-open-brief[^>]*background:#356292;color:#ffffff/);
    expect(html).not.toMatch(/background:#(ffffff|fafaf9|f6f5f2)/i);
  });

  it("shows the text wordmark when no logo file is present", () => {
    const body = renderEmailBody(model, { briefUrl: "#/brief", logoUrl: null });
    expect(body).toContain(">AZIMUT</span>");
    expect(body).toContain("Daily Market Brief</span>");
    expect(body).not.toContain("<img");
  });

  it("shows the logo from public/brand/ when the file exists", () => {
    const body = renderEmailBody(model, { briefUrl: "#/brief", logoUrl: "brand/azimut-logo.svg" });
    expect(body).toContain('<img src="brand/azimut-logo.svg" alt="Azimut"');
    expect(body).not.toContain(">AZIMUT</span>");
  });
});
