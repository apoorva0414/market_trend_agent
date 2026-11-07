import { data as defaultData, type DataSet } from "../data";
import type { ActiveTheme, BookState, NewsItem, PositionEvent, PositionEventType, RankedClient, ThemeAssessment } from "../types";
import { computeExposure, isAffected } from "./exposure";
import { barrierFlag } from "./flags";
import { priorityForRank, scoreExposure } from "./scoring";

// Shared helpers for the two processes (update 3): the daily brief job and the alert monitor.
// Both look at the RM's book through the same lens: which items have arrived, which themes they form,
// and how much each client is exposed.

/** "HH:MM" SGT of an ISO timestamp written with a +08:00 offset. */
export function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Items published on `date` at or before `at` ("HH:MM", inclusive). */
export function receivedBy<T extends { publishedAt: string }>(items: T[], date: string, at: string): T[] {
  return items.filter((item) => item.publishedAt.startsWith(date) && timeOf(item.publishedAt) <= at);
}

export const EVENT_CAUSE: Record<PositionEventType, string> = {
  "Call notice": "bond call notice",
  Downgrade: "a downgrade",
  "Barrier proximity": "barrier risk",
  Default: "a default",
};

/**
 * A position event with a narrative is ranked like a theme, but only for the clients holding
 * that instrument (its tag is carried by that instrument alone). It is never a market theme.
 */
function eventThemes(events: PositionEvent[]): ActiveTheme[] {
  return events.flatMap((event) =>
    event.narrative
      ? [
          {
            ...event.narrative,
            id: event.id,
            type: "Pulse" as const,
            alertCause: EVENT_CAUSE[event.eventType],
            briefTone: "",
            briefHeadline: "",
            briefMention: "",
            sources: ["Position events"],
            newsIds: [],
            status: event.batch === "intraday" ? ("new" as const) : ("unchanged" as const),
            positionEventId: event.id,
          },
        ]
      : [],
  );
}

/** Keep market-moving items and group them into themes. */
export function activeThemes(dataSet: DataSet, read: NewsItem[]): ActiveTheme[] {
  const relevant = read.filter((n) => n.relevant && n.themeId);
  const themes: ActiveTheme[] = [];
  for (const theme of dataSet.themes) {
    const items = relevant.filter((n) => n.themeId === theme.id);
    if (items.length === 0) continue;
    const update = items.some((n) => n.batch === "intraday") ? theme.intradayUpdate : undefined;
    themes.push({
      ...theme,
      affectedTags: update ? update.affectedTags : theme.affectedTags,
      sources: [...new Set(items.map((n) => n.source))],
      newsIds: items.map((n) => n.id),
      status: update ? "updated" : "unchanged",
      updateNote: update?.note,
    });
  }
  return themes;
}

/** Match themes to the RM's clients and rank them by priority score. */
export function rankClients(dataSet: DataSet, themes: ActiveTheme[], rmId: string, date: string): RankedClient[] {
  const rows: Omit<RankedClient, "rank" | "priority">[] = [];
  for (const client of dataSet.clients.filter((c) => c.rmId === rmId)) {
    const assessments: ThemeAssessment[] = [];
    for (const theme of themes) {
      const exposure = computeExposure(client, dataSet.holdings, theme);
      if (!isAffected(exposure)) continue;
      const flag = barrierFlag(theme, exposure);
      assessments.push({ theme, exposure, factors: scoreExposure(client, exposure, date), ...(flag ? { flag } : {}) });
    }
    if (assessments.length === 0) continue;
    assessments.sort((a, b) => b.factors.score - a.factors.score);
    rows.push({ client, primary: assessments[0], others: assessments.slice(1) });
  }
  rows.sort(
    (a, b) =>
      b.primary.factors.score - a.primary.factors.score ||
      Math.abs(b.primary.exposure.estImpactUsd) - Math.abs(a.primary.exposure.estImpactUsd) ||
      a.client.name.localeCompare(b.client.name),
  );
  return rows.map((row, index) => ({ ...row, rank: index + 1, priority: priorityForRank(index, rows.length) }));
}

/** The RM's book as it stands once every item published up to `at` has arrived. Pure. */
export function bookStateAt({ date, rmId, at }: { date: string; rmId: string; at: string }, dataSet: DataSet = defaultData): BookState {
  const news = receivedBy(dataSet.news, date, at);
  const themes = activeThemes(dataSet, news);
  const positionEvents = receivedBy(dataSet.positionEvents, date, at);
  return {
    date,
    rmId,
    at,
    news,
    themes,
    positionEvents,
    clients: rankClients(dataSet, [...themes, ...eventThemes(positionEvents)], rmId, date),
    clientCount: dataSet.clients.filter((c) => c.rmId === rmId).length,
  };
}
