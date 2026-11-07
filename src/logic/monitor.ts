import { alertRules as defaultRules, type AlertRules } from "../config/alertRules";
import { data as defaultData, type DataSet } from "../data";
import type { Alert, AlertTrigger, MonitorEvaluation, MonitorItem } from "../types";
import { alertId, evaluateAlerts } from "./alerts";
import { addMinutes, bookStateAt, timeOf } from "./book";

// The alert monitor (update 3, 1.2). Event-driven, with no schedule: it evaluates each news item or
// position event as soon as it arrives and sends a Client Alert only when a client newly meets the rule.

/** A Client Alert goes out a minute after the item that caused it. */
export const ALERT_DELAY_MINUTES = 1;

/** Every news item and position event of the day, in arrival order. */
export function monitorItems(date: string, dataSet: DataSet = defaultData): MonitorItem[] {
  const news: MonitorItem[] = dataSet.news.map((n) => ({ id: n.id, kind: "news", headline: n.headline, publishedAt: n.publishedAt, batch: n.batch }));
  const events: MonitorItem[] = dataSet.positionEvents.map((e) => ({ id: e.id, kind: "event", headline: e.headline, publishedAt: e.publishedAt, batch: e.batch }));
  return [...news, ...events].filter((i) => i.publishedAt.startsWith(date)).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}

export interface IncomingArgs {
  date: string;
  rmId: string;
  /** One item, or several that arrived at the same moment (evaluated together, at most one email). */
  item: MonitorItem | MonitorItem[];
  /** Everything already alerted today. */
  alreadyAlerted: Pick<AlertTrigger, "clientId" | "key" | "covers">[];
  rules?: AlertRules;
  dataSet?: DataSet;
}

/** Evaluates an incoming item against the alert rule. Returns the Client Alert to send, or null. Pure. */
export function evaluateIncomingItem({ date, rmId, item, alreadyAlerted, rules = defaultRules, dataSet = defaultData }: IncomingArgs): Alert | null {
  const items = Array.isArray(item) ? item : [item];
  if (items.length === 0) return null;
  const at = items.map((i) => timeOf(i.publishedAt)).sort().at(-1) as string;
  const state = bookStateAt({ date, rmId, at }, dataSet);
  const eventIds = items.filter((i) => i.kind === "event").map((i) => i.id);
  const triggers = evaluateAlerts({ state, eventIds, rmId, alreadyAlerted, rules, dataSet });
  if (triggers.length === 0) return null;
  const time = addMinutes(at, ALERT_DELAY_MINUTES);
  return { id: alertId(rmId, date, time), rmId, date, detectedAt: `${date}T${time}:00+08:00`, time, itemIds: items.map((i) => i.id), triggers };
}

/** Items grouped by arrival time: items published at the same moment are evaluated together. */
export function arrivals(date: string, dataSet: DataSet = defaultData): MonitorItem[][] {
  const groups = new Map<string, MonitorItem[]>();
  for (const item of monitorItems(date, dataSet)) {
    const key = timeOf(item.publishedAt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
}

/** Replays the monitor over the day up to `until` ("HH:MM"): every evaluation, and the alerts it sent. */
export function simulateMonitor(
  { date, rmId, until }: { date: string; rmId: string; until: string },
  rules: AlertRules = defaultRules,
  dataSet: DataSet = defaultData,
): { evaluations: MonitorEvaluation[]; alerts: Alert[] } {
  const evaluations: MonitorEvaluation[] = [];
  const alerts: Alert[] = [];
  for (const group of arrivals(date, dataSet)) {
    if (timeOf(group[0].publishedAt) > until) break;
    const alert = evaluateIncomingItem({ date, rmId, item: group, alreadyAlerted: alerts.flatMap((a) => a.triggers), rules, dataSet });
    if (alert) alerts.push(alert);
    for (const item of group) {
      evaluations.push({ itemId: item.id, headline: item.headline, evaluatedAt: item.publishedAt, ...(alert ? { alertId: alert.id } : {}) });
    }
  }
  return { evaluations, alerts };
}

/** Arrival time of the next item after `after`, or null when the day has no more items. */
export function nextArrival(date: string, after: string, dataSet: DataSet = defaultData): string | null {
  const next = arrivals(date, dataSet).find((group) => timeOf(group[0].publishedAt) > after);
  return next ? timeOf(next[0].publishedAt) : null;
}
