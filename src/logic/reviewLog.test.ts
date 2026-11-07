import { describe, expect, it } from "vitest";
import { data, DEMO_DATE, SEED_REVIEW_LOG } from "../data";
import { bookStateAt } from "./book";
import { simulateMonitor } from "./monitor";
import { clientStatus, ensureReviewEntry, isLogged, lastReviewDate, periodEntries, timeUntil, withApproval, withLogged, withOutcome, withShare } from "./reviewLog";

const [alert] = simulateMonitor({ date: DEMO_DATE, rmId: "rm-kevin", until: "09:05" }).alerts;
const trigger = alert.triggers[0]; // Eleanor Chua
const row = bookStateAt({ date: DEMO_DATE, rmId: "rm-kevin", at: alert.time }).clients.find((r) => r.client.id === trigger.clientId);
const eleanor = data.clients.find((c) => c.id === trigger.clientId)!;
const NOW = "2026-10-12T09:15:00.000Z";

describe("Log to Portfolio Review (update 2, section 6)", () => {
  it("creates one entry the first time a workspace is opened, and never a duplicate", () => {
    const first = ensureReviewEntry([], alert, trigger, row, eleanor.nextReviewDate, NOW);
    expect(first.created).not.toBeNull();
    expect(first.entries).toHaveLength(1);
    const again = ensureReviewEntry(first.entries, alert, trigger, row, eleanor.nextReviewDate, "2026-10-12T10:00:00.000Z");
    expect(again.created).toBeNull();
    expect(again.entries).toBe(first.entries);
  });

  it("captures the trigger, a holdings snapshot and the next review date", () => {
    const { created } = ensureReviewEntry([], alert, trigger, row, eleanor.nextReviewDate, NOW);
    expect(created).toMatchObject({
      clientId: eleanor.id,
      rmId: "rm-kevin",
      alertId: alert.id,
      trigger: { kind: "material-impact", themeId: "theme-us-yields", reason: trigger.reason },
      talkingPoints: { status: "drafted" },
      discussAtNextReview: false,
      nextReviewDate: "2027-01-15",
    });
    expect(created?.holdingsSnapshot.map((h) => h.instrument)).toContain("US Treasury 4.25% 2046");
  });

  it("records approval and sharing, and moves the status along", () => {
    const { created } = ensureReviewEntry([], alert, trigger, row, eleanor.nextReviewDate, NOW);
    expect(clientStatus(undefined)).toBe("Not started");
    expect(clientStatus(created!)).toBe("In progress");
    const approved = withApproval(created!, 3);
    expect(approved.talkingPoints).toEqual({ status: "approved", approvedVersion: 3 });
    expect(clientStatus(approved)).toBe("Talking points approved");
    const shared = withShare(withShare(approved, "WhatsApp", 3, NOW), "Email", 3, NOW);
    expect(shared.talkingPoints).toEqual({ status: "shared", approvedVersion: 3, sharedVia: ["WhatsApp", "Email"], sharedAt: NOW });
    expect(clientStatus(shared)).toBe("Shared");
  });

  it("ticks Discuss at next review when concerns were raised, and leaves it to the RM otherwise", () => {
    const { created } = ensureReviewEntry([], alert, trigger, row, eleanor.nextReviewDate, NOW);
    expect(withOutcome(created!, "Contacted: concerns raised").discussAtNextReview).toBe(true);
    expect(withOutcome(created!, "Contacted: no concerns").discussAtNextReview).toBe(false);
    const unticked = { ...withOutcome(created!, "Contacted: concerns raised"), discussAtNextReview: false };
    expect(withOutcome(unticked, "Contacted: concerns raised").discussAtNextReview).toBe(true);
    expect(withOutcome(created!, undefined)).not.toHaveProperty("outcome");
  });

  it("shows No contact needed as the status when chosen", () => {
    const { created } = ensureReviewEntry([], alert, trigger, row, eleanor.nextReviewDate, NOW);
    expect(clientStatus(withOutcome(withApproval(created!, 2), "No contact needed"))).toBe("No contact needed");
  });

  it("builds the period timeline from the seeded history plus today's entry", () => {
    expect(lastReviewDate("2027-01-15")).toBe("2026-07-15");
    const { entries } = ensureReviewEntry(SEED_REVIEW_LOG, alert, trigger, row, eleanor.nextReviewDate, `${DEMO_DATE}T01:15:00.000Z`);
    const logged = entries.map((e) => withLogged(e, `${DEMO_DATE}T01:20:00.000Z`));
    const period = periodEntries(logged, eleanor.id, eleanor.nextReviewDate);
    expect(period.map((e) => e.createdAt.slice(0, 7))).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(period.filter((e) => e.discussAtNextReview)).toHaveLength(1);
    expect(SEED_REVIEW_LOG.every((e) => e.clientId === eleanor.id && e.rmId === "rm-kevin")).toBe(true);
  });

  it("only includes entries the RM logged; a drafted entry stays out until 'Log for next portfolio review'", () => {
    const { entries, created } = ensureReviewEntry(SEED_REVIEW_LOG, alert, trigger, row, eleanor.nextReviewDate, `${DEMO_DATE}T01:15:00.000Z`);
    expect(isLogged(created!)).toBe(false);
    expect(periodEntries(entries, eleanor.id, eleanor.nextReviewDate)).toHaveLength(2);
    const logged = withLogged(created!, NOW);
    expect(logged.loggedAt).toBe(NOW);
    expect(withLogged(logged, "2026-10-12T11:00:00.000Z").loggedAt).toBe(NOW);
  });

  it("says how far away a review is in plain words", () => {
    expect(timeUntil(DEMO_DATE, DEMO_DATE)).toBe("today");
    expect(timeUntil("2026-10-15", DEMO_DATE)).toBe("in 3 days");
    expect(timeUntil("2027-01-15", DEMO_DATE)).toMatch(/^in \d+ weeks$/);
  });
});
