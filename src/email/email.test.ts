import { describe, expect, it } from "vitest";
import { data, DEMO_DATE } from "../data";
import { bookStateAt } from "../logic/book";
import { runDailyBrief } from "../logic/brief";
import { simulateMonitor } from "../logic/monitor";
import { ALERT_FOOTER, ALERT_FROM, BRIEF_FOOTER, buildAlertEmail, buildBriefEmail, READY_LINE, renderEmailBody, renderEmailDocument } from "./template";

const [kevin, sarah] = data.rms;
const visible = (html: string) => html.replace(/<[^>]+>/g, " ");
/** Instrument names are product names; strip them before checking that no figures are shown. */
const withoutInstruments = (text: string) => data.holdings.reduce((t, h) => t.split(h.instrument).join(" "), text);
const alertsFor = (rmId: string) => simulateMonitor({ date: DEMO_DATE, rmId, until: "23:59" }).alerts;
const alertEmail = (rm: typeof kevin, index: number) => {
  const alert = alertsFor(rm.id)[index];
  return buildAlertEmail(alert, rm, bookStateAt({ date: DEMO_DATE, rmId: rm.id, at: alert.time }));
};

describe("MarketPulse Daily Brief email (update 3, 2.2)", () => {
  const brief = buildBriefEmail(runDailyBrief({ date: DEMO_DATE, rmId: kevin.id }), kevin);
  const body = renderEmailBody(brief, { logoUrl: null });
  const text = visible(body);

  it("comes from the brief, at 09:00, with the read-only subject", () => {
    expect(brief).toMatchObject({ from: "MarketPulse (Azimut)", to: "Kevin Tan", time: "09:00 SGT", subject: "MarketPulse Daily Brief, Mon 12 Oct: 4 themes" });
  });

  it("opens with the RM's first name and one summary sentence", () => {
    expect(text).toContain("Good morning Kevin,");
    expect(brief.summary).toBe("A rates-driven morning: yields up after Fed signals, with China stimulus, Big Tech bond supply and oil also in focus.");
  });

  it("contains the whole brief: themes with relevance to the book, holding events, house view and footer", () => {
    expect(brief.themes[0]).toMatchObject({
      title: "US yields jump after hawkish Fed signals",
      relevance: "6 of your clients hold long-duration USD bonds, REITs or short-duration bonds.",
      why: "Portfolios holding long-duration USD bonds or REITs take the largest mark-to-market hit.",
    });
    expect(text).toContain("Opinion: stress-test before sharing");
    expect(text).toContain("Sources: Market news wire, Partner bank A morning note, Partner bank B CIO daily");
    expect(brief.events).toEqual(["Barrier proximity on Worst-of Autocallable Note on NVDA / MSFT / AVGO (60% barrier): held by 1 of your clients."]);
    expect(text).toContain("House view");
    expect(brief.houseView).toMatch(/^US equities: neutral\. .*USD bonds: neutral duration, prefer short end/);
    expect(body).toContain(BRIEF_FOOTER);
    expect(BRIEF_FOOTER).toBe("For information only. No action needed. If something materially affects a specific client, you'll receive a separate Client Alert.");
  });

  it("has no buttons or links", () => {
    expect(body).not.toMatch(/<a\s|href=|<button/i);
    expect(renderEmailDocument(brief, { logoUrl: null })).not.toMatch(/<a\s|href=/i);
  });

  it("shows no client names, and no values or percentages about the book (market facts such as Brent +6% are fine)", () => {
    for (const client of data.clients) expect(text).not.toContain(client.name);
    const bookLines = [brief.summary, ...brief.themes.map((t) => t.relevance), ...brief.events.map(withoutInstruments), brief.houseView.replace(/3 to 5%|5 to 10%/g, "")];
    for (const line of bookLines) expect(line).not.toMatch(/USD \d|%|\d+(\.\d+)?\s?(m|k)\b/);
  });

  it("says when a theme does not touch the book", () => {
    const sarahBrief = buildBriefEmail(runDailyBrief({ date: DEMO_DATE, rmId: sarah.id }), sarah);
    expect(sarahBrief.themes.every((t) => t.relevance.endsWith("."))).toBe(true);
    expect(buildBriefEmail({ ...runDailyBrief({ date: DEMO_DATE, rmId: sarah.id }), themes: runDailyBrief({ date: DEMO_DATE, rmId: sarah.id }).themes.map((t) => ({ ...t, clientsExposed: 0 })) }, sarah).themes[0].relevance).toBe(
      "No direct exposure in your book.",
    );
  });
});

describe("Client Alert email (update 3, section 3)", () => {
  const email = alertEmail(kevin, 0);
  const body = renderEmailBody(email, { href: `#/alerts/${email.alertId}`, logoUrl: null });
  const text = visible(body);

  it("has its own identity: Client Alerts sender and an amber CLIENT ALERT header, never the brief's name", () => {
    expect(email.from).toBe(ALERT_FROM);
    expect(ALERT_FROM).toBe("MarketPulse Alerts (Azimut)");
    expect(body).toMatch(/background:#e0a24a[^>]*>CLIENT ALERT</);
    for (const rm of data.rms) {
      for (let i = 0; i < alertsFor(rm.id).length; i++) {
        const e = alertEmail(rm, i);
        const html = renderEmailDocument(e, { href: "#", logoUrl: null });
        expect(html).not.toContain("Daily Brief");
        expect(e.subject).not.toContain("Daily Brief");
      }
    }
  });

  it("names the cause and count in the subject", () => {
    expect(email.subject).toBe("Client Alert: 2 clients affected by US rate move and barrier risk");
    expect(alertEmail(kevin, 1).subject).toBe("Client Alert: 1 client affected by bond call notice");
  });

  it("explains what happened, why each client, and what is ready", () => {
    expect(email.opening).toBe("New developments at 06:41 SGT materially affect 2 of your clients.");
    expect(email.causes.map((c) => [c.headline, c.badge.label])).toEqual([
      ["US yields jump after hawkish Fed signals", "View"],
      ["Tech worst-of note now trades within 10% of its 60% barrier", "Barrier proximity"],
    ]);
    expect(email.clients).toEqual([
      { name: "Eleanor Chua", priority: "High", why: "Large holding in long-duration USD bonds and REITs, estimated impact above the alert threshold" },
      { name: "Rajesh Menon", priority: "Medium", why: "Holds the structured note now close to its barrier" },
    ]);
    expect(text).toContain(READY_LINE);
    expect(READY_LINE).toBe("Talking points drafted");
  });

  it("gives the reason for sending from alertRules.ts, the portal button and the footer", () => {
    expect(email.reason).toBe(
      "Sent because these clients met the alert threshold: a specific event on a holding, an estimated impact of 1% of portfolio or more, or 10% or more of the portfolio in holdings hit by a move of 3% or more.",
    );
    expect(body).toContain(`href="#/alerts/${email.alertId}"`);
    expect(body).toContain(">Open in portal</a>");
    expect(body).toContain(ALERT_FOOTER);
  });

  it("shows no amounts or percentages about clients", () => {
    const words = withoutInstruments(text.replace(email.causes[1].headline, " ").replace(email.reason, " ").replace(email.causes[1].text, " "));
    expect(words).not.toMatch(/USD \d|\d+(\.\d+)?\s?(m|k)\b/);
    for (const c of email.clients) expect(c.why).not.toMatch(/\d/);
  });
});

describe("email branding", () => {
  const brief = buildBriefEmail(runDailyBrief({ date: DEMO_DATE, rmId: kevin.id }), kevin);

  it("uses the dark Azimut styling", () => {
    const html = renderEmailDocument(brief, { logoUrl: null });
    expect(html).toContain("background:#0d1520");
    expect(html).toContain("Prototype with sample data");
  });

  it("shows the text wordmark without a logo file, and the logo when one exists", () => {
    expect(renderEmailBody(brief, { logoUrl: null })).toContain(">AZIMUT</span>");
    expect(renderEmailBody(brief, { logoUrl: "brand/azimut-logo.svg" })).toContain('<img src="brand/azimut-logo.svg" alt="Azimut"');
  });
});
