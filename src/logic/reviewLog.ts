import type { Alert, AlertTrigger, RankedClient, ReviewLogEntry, ReviewOutcome } from "../types";

// Log to Portfolio Review (update 2, section 6). One entry per client per trigger. It is drafted when the
// RM opens the client from an alert and kept up to date as they work; it reaches the client's next
// scheduled review once the RM clicks "Log for next portfolio review" (loggedAt is set).

export const OUTCOMES: ReviewOutcome[] = ["Contacted: no concerns", "Contacted: concerns raised", "Could not reach", "No contact needed"];

export function reviewEntryId(alert: Alert, clientId: string): string {
  return `RL-${alert.id.slice(2)}-${clientId}`;
}

/** Drafts the entry the first time a client workspace is opened. Opening it again changes nothing. */
export function ensureReviewEntry(
  entries: ReviewLogEntry[],
  alert: Alert,
  trigger: AlertTrigger,
  row: RankedClient | undefined,
  nextReviewDate: string,
  now: string,
): { entries: ReviewLogEntry[]; created: ReviewLogEntry | null } {
  const id = reviewEntryId(alert, trigger.clientId);
  if (entries.some((entry) => entry.id === id)) return { entries, created: null };
  const holdings = row ? [row.primary, ...row.others].flatMap((a) => a.exposure.holdings) : [];
  const seen = new Set<string>();
  const created: ReviewLogEntry = {
    id,
    clientId: trigger.clientId,
    rmId: alert.rmId,
    alertId: alert.id,
    createdAt: now,
    updatedAt: now,
    trigger: {
      kind: trigger.kind,
      ...(trigger.themeId ? { themeId: trigger.themeId } : {}),
      ...(trigger.positionEventId ? { positionEventId: trigger.positionEventId } : {}),
      reason: trigger.reason,
      summary: trigger.summary,
    },
    holdingsSnapshot: holdings
      .filter((h) => !seen.has(h.holding.instrument) && seen.add(h.holding.instrument))
      .map((h) => ({ instrument: h.holding.instrument, bank: h.holding.bank, marketValueUsd: h.holding.marketValueUsd, estImpactUsd: h.estImpactUsd })),
    talkingPoints: { status: "drafted" },
    discussAtNextReview: false,
    nextReviewDate,
  };
  return { entries: [...entries, created], created };
}

export function updateEntry(entries: ReviewLogEntry[], id: string, change: (entry: ReviewLogEntry) => ReviewLogEntry, now: string): ReviewLogEntry[] {
  return entries.map((entry) => (entry.id === id ? { ...change(entry), updatedAt: now } : entry));
}

/** Choosing "Contacted: concerns raised" ticks "Discuss at next review"; the RM can untick it. */
export function withOutcome(entry: ReviewLogEntry, outcome: ReviewOutcome | undefined): ReviewLogEntry {
  const next: ReviewLogEntry = { ...entry, outcome };
  if (!outcome) delete next.outcome;
  if (outcome === "Contacted: concerns raised") next.discussAtNextReview = true;
  return next;
}

export function withApproval(entry: ReviewLogEntry, version: number): ReviewLogEntry {
  return { ...entry, talkingPoints: { ...entry.talkingPoints, status: entry.talkingPoints.status === "shared" ? "shared" : "approved", approvedVersion: version } };
}

export function withShare(entry: ReviewLogEntry, channel: string, version: number, now: string): ReviewLogEntry {
  const sharedVia = [...new Set([...(entry.talkingPoints.sharedVia ?? []), channel])];
  return { ...entry, talkingPoints: { status: "shared", approvedVersion: version, sharedVia, sharedAt: now } };
}

export type ClientStatus = "Not started" | "In progress" | "Talking points approved" | "Shared" | "No contact needed";

/** Marks the entry as logged for the next review (or keeps the first logging time). */
export function withLogged(entry: ReviewLogEntry, now: string): ReviewLogEntry {
  return { ...entry, loggedAt: entry.loggedAt ?? now };
}

export function isLogged(entry: ReviewLogEntry): boolean {
  return entry.loggedAt !== undefined;
}

export function clientStatus(entry: ReviewLogEntry | undefined): ClientStatus {
  if (!entry) return "Not started";
  if (entry.outcome === "No contact needed") return "No contact needed";
  if (entry.talkingPoints.status === "shared") return "Shared";
  if (entry.talkingPoints.status === "approved") return "Talking points approved";
  return "In progress";
}

/** Six-monthly reviews: the previous one was six months before the next. */
export function lastReviewDate(nextReviewDate: string): string {
  const date = new Date(`${nextReviewDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 6);
  return date.toISOString().slice(0, 10);
}

/** Logged entries for one client since the last review, oldest first. This is the Portfolio Review agent's payload. */
export function periodEntries(entries: ReviewLogEntry[], clientId: string, nextReviewDate: string): ReviewLogEntry[] {
  const since = lastReviewDate(nextReviewDate);
  return entries
    .filter((e) => e.clientId === clientId && isLogged(e) && e.createdAt.slice(0, 10) >= since)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** "in 10 weeks", counted from the demo date. */
export function timeUntil(date: string, from: string): string {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return "today";
  if (days < 14) return `in ${days} ${days === 1 ? "day" : "days"}`;
  return `in ${Math.round(days / 7)} weeks`;
}
