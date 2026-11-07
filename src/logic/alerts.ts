import { alertRules as defaultRules, type AlertRules } from "../config/alertRules";
import { data as defaultData, type DataSet } from "../data";
import type { AlertTrigger, AssetClass, BookState, Client, PositionEvent, PositionEventType, Tag } from "../types";
import { computeExposure } from "./exposure";
import { fmtMove, fmtPct, joinList, TAG_LABEL } from "./format";

// The alert rule (update 2, section 4.3). Pure: the alert monitor calls it for each incoming item.

const EVENT_OBJECT: Record<AssetClass, string> = {
  Bond: "bond",
  "Structured Product": "structured note",
  Equity: "share",
  Fund: "fund",
  Cash: "deposit",
};

/** "Why this client" for an event: "Holds the structured note now close to its barrier". */
const EVENT_WHY: Record<PositionEventType, (object: string) => string> = {
  "Barrier proximity": (object) => `Holds the ${object} now close to its barrier`,
  "Call notice": (object) => `Holds the ${object} being called`,
  Downgrade: (object) => `Holds the ${object} that was downgraded`,
  Default: (object) => `Holds the ${object} now in default`,
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Readable names of the tags a client holds for one theme, largest first. */
function heldLabels(holdings: { tag: Tag; holding: { marketValueUsd: number } }[]): string {
  const byTag = new Map<Tag, number>();
  for (const h of holdings) byTag.set(h.tag, (byTag.get(h.tag) ?? 0) + h.holding.marketValueUsd);
  return joinList([...byTag.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => TAG_LABEL[tag]));
}

const threshold = (value: number, digits: number) => `${value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;

export interface EvaluateArgs {
  state: BookState;
  /** Position events that arrived with this item. Events count only when they arrive. */
  eventIds: string[];
  rmId: string;
  /** Triggers already sent today. A client is not alerted again for the same theme or event. */
  alreadyAlerted: Pick<AlertTrigger, "clientId" | "key" | "covers">[];
  rules?: AlertRules;
  dataSet?: DataSet;
}

/** Every condition that holds for one client, in priority order: position event, A, B. */
export function candidateTriggers(client: Client, state: BookState, eventIds: string[], rules: AlertRules, dataSet: DataSet): Omit<AlertTrigger, "covers">[] {
  const holdings = dataSet.holdings.filter((h) => h.clientId === client.id);
  const found: Omit<AlertTrigger, "covers">[] = [];

  // Position events: always alert anyone holding the instrument.
  const events: PositionEvent[] = state.positionEvents.filter((e) => eventIds.includes(e.id) && rules.positionEventTypes.includes(e.eventType));
  for (const event of events) {
    const holding = holdings.find((h) => h.instrument === event.instrument);
    if (!holding) continue;
    found.push({
      clientId: client.id,
      kind: "position-event",
      positionEventId: event.id,
      reason: `${event.eventType} on ${event.instrument}`,
      whyClient: EVENT_WHY[event.eventType](EVENT_OBJECT[holding.assetClass]),
      summary: `${event.eventType} on ${event.instrument}`,
      key: event.id,
    });
  }

  const losses = (value: number) => rules.includeGains || value < 0;

  // A: material estimated impact. The theme with the largest qualifying impact is reported.
  const impacts = state.themes
    .map((theme) => ({ theme, exposure: computeExposure(client, dataSet.holdings, theme) }))
    .filter(({ exposure }) => losses(exposure.estImpactUsd))
    .filter(({ exposure }) => {
      const pct = exposure.estImpactPct * 100;
      return rules.includeGains && pct > 0 ? pct >= Math.abs(rules.impactPctThreshold) : pct <= rules.impactPctThreshold;
    })
    .sort((a, b) => Math.abs(b.exposure.estImpactPct) - Math.abs(a.exposure.estImpactPct));
  for (const { theme, exposure } of impacts) {
    found.push({
      clientId: client.id,
      kind: "material-impact",
      themeId: theme.id,
      reason: `Estimated impact ${fmtPct(exposure.estImpactPct, 1, true)} of AUM from ${theme.title} (alert threshold ${threshold(rules.impactPctThreshold, 1)})`,
      whyClient: `Large holding in ${heldLabels(exposure.holdings)}, estimated impact above the alert threshold`,
      summary: `${capitalise(theme.alertCause)} hit ${heldLabels(exposure.holdings)}`,
      key: theme.id,
    });
  }

  // B: concentrated exposure to a sharp move, judged tag by tag within a theme.
  for (const theme of state.themes) {
    const exposure = computeExposure(client, dataSet.holdings, theme);
    const byTag = new Map<string, { value: number; move: number }>();
    for (const h of exposure.holdings) {
      const entry = byTag.get(h.tag) ?? { value: 0, move: h.estMovePct };
      entry.value += h.holding.marketValueUsd;
      byTag.set(h.tag, entry);
    }
    const qualifying = [...byTag.entries()]
      .filter(([, { move }]) => (rules.includeGains ? Math.abs(move) >= Math.abs(rules.movePctThreshold) : move <= rules.movePctThreshold))
      .filter(([, { value }]) => (value / client.aumUsd) * 100 >= rules.exposurePctThreshold)
      .sort((a, b) => b[1].value - a[1].value);
    const top = qualifying[0];
    if (!top) continue;
    const [tag, { value, move }] = top;
    found.push({
      clientId: client.id,
      kind: "concentrated-exposure",
      themeId: theme.id,
      reason: `${Math.round((value / client.aumUsd) * 100)}% of AUM exposed to ${theme.title}, move ${fmtMove(move)} (alert threshold: ${Math.abs(rules.exposurePctThreshold)}% exposure and ${threshold(rules.movePctThreshold, 0)} move)`,
      whyClient: `Large holding in ${TAG_LABEL[tag as Tag]}, which this news moves sharply`,
      summary: `${capitalise(theme.alertCause)} moved ${TAG_LABEL[tag as Tag]} sharply`,
      key: theme.id,
    });
  }

  return found;
}

/**
 * One trigger per client who meets the rule, after removing anything already alerted today.
 * Clients are ordered by priority score, then by name for clients outside the ranked list.
 */
export function evaluateAlerts({ state, eventIds, rmId, alreadyAlerted, rules = defaultRules, dataSet = defaultData }: EvaluateArgs): AlertTrigger[] {
  // A client already alerted today counts as alerted for everything that met the rule at the time.
  const sent = new Set(alreadyAlerted.flatMap((t) => [t.key, ...t.covers].map((key) => `${t.clientId}|${key}`)));
  const rank = new Map(state.clients.map((row) => [row.client.id, row.rank]));
  return dataSet.clients
    .filter((client) => client.rmId === rmId)
    .flatMap((client) => {
      const fresh = candidateTriggers(client, state, eventIds, rules, dataSet).filter((t) => !sent.has(`${t.clientId}|${t.key}`));
      return fresh.length > 0 ? [{ ...fresh[0], covers: [...new Set(fresh.map((t) => t.key))] }] : [];
    })
    .sort((a, b) => (rank.get(a.clientId) ?? 999) - (rank.get(b.clientId) ?? 999));
}

export function alertId(rmId: string, date: string, time: string): string {
  return `A-${date.replaceAll("-", "")}-${rmId.replace("rm-", "")}-${time.replace(":", "")}`;
}
