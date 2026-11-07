import { data as defaultData, type DataSet, DELIVERY_TIME, SCAN_TIME } from "../data";
import type { DailyBrief, Tag } from "../types";
import { activeThemes, rankClients, receivedBy } from "./book";
import { TAG_LABEL } from "./format";

/** Readable list joined with "or": "long-duration USD bonds or REITs". */
function orList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/**
 * The daily brief job (update 3, 1.1). Runs once per business day at 08:30 SGT on the morning batch only,
 * and is delivered by email at 09:00. It never creates alerts and never links to the portal.
 */
export function runDailyBrief({ date, rmId }: { date: string; rmId: string }, dataSet: DataSet = defaultData): DailyBrief {
  const news = receivedBy(dataSet.news, date, SCAN_TIME).filter((n) => n.batch === "morning");
  const events = receivedBy(dataSet.positionEvents, date, SCAN_TIME).filter((e) => e.batch === "morning");
  const themes = activeThemes(dataSet, news);
  const clients = dataSet.clients.filter((c) => c.rmId === rmId);
  const holdingsOf = (clientId: string) => dataSet.holdings.filter((h) => h.clientId === clientId);

  const briefThemes = themes
    .map((theme, order) => {
      const tags = theme.affectedTags.map((t) => t.tag);
      const holders = clients.filter((c) => holdingsOf(c.id).some((h) => h.tags.some((tag) => tags.includes(tag))));
      const held = tags.filter((tag) => holders.some((c) => holdingsOf(c.id).some((h) => h.tags.includes(tag))));
      return { theme, clientsExposed: holders.length, assetTypes: orList(held.map((tag) => TAG_LABEL[tag])), order };
    })
    // Most relevant to this RM's book first; ties keep the news order.
    .sort((a, b) => b.clientsExposed - a.clientsExposed || a.order - b.order)
    .map(({ order: _order, ...rest }) => rest);

  const touched = new Set<Tag>(themes.flatMap((t) => t.affectedTags.map((a) => a.tag)));
  const houseView = dataSet.houseView
    .filter((entry) => entry.tags.some((tag) => touched.has(tag)))
    .map((entry) => ({ assetClass: entry.assetClass, stance: entry.stance }));

  return {
    date,
    rmId,
    generatedAt: SCAN_TIME,
    deliveredAt: DELIVERY_TIME,
    themes: briefThemes,
    events: events
      .map((event) => ({ event, holders: clients.filter((c) => holdingsOf(c.id).some((h) => h.instrument === event.instrument)).length }))
      .filter(({ holders }) => holders > 0),
    houseView,
    clientsExposed: rankClients(dataSet, themes, rmId, date).length,
  };
}
