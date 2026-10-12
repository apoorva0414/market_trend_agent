import { data as defaultData, type DataSet, AD_HOC_TIME, DELIVERY_TIME, SCAN_TIME } from "../data";
import type {
  ActiveTheme,
  NewsItem,
  RankedClient,
  ScanArgs,
  ScanBatch,
  ScanResult,
  ThemeAssessment,
} from "../types";
import { computeExposure, isAffected } from "./exposure";
import { recommendNextStep } from "./nextStep";
import { selectProspectThemes } from "./prospects";
import { priorityForRank, scoreExposure } from "./scoring";

function itemsRead(news: NewsItem[], date: string, upTo: ScanBatch): NewsItem[] {
  return news.filter((n) => n.publishedAt.startsWith(date) && (upTo === "intraday" || n.batch === "morning"));
}

/** Steps 2 and 3 of the pipeline: keep market-moving items and group them into themes. */
function activeThemes(dataSet: DataSet, read: NewsItem[]): ActiveTheme[] {
  const relevant = read.filter((n) => n.relevant && n.themeId);
  const themes: ActiveTheme[] = [];
  for (const theme of dataSet.themes) {
    const items = relevant.filter((n) => n.themeId === theme.id);
    if (items.length === 0) continue;
    const hasIntradayNews = items.some((n) => n.batch === "intraday");
    const update = hasIntradayNews && theme.batch === "morning" ? theme.intradayUpdate : undefined;
    themes.push({
      ...theme,
      affectedTags: update ? update.affectedTags : theme.affectedTags,
      sources: [...new Set(items.map((n) => n.source))],
      newsIds: items.map((n) => n.id),
      status: theme.batch === "intraday" ? "new" : update ? "updated" : "unchanged",
      updateNote: update?.note,
    });
  }
  return themes;
}

/** Step 4: match themes to the RM's clients and rank them. */
function rankClients(dataSet: DataSet, themes: ActiveTheme[], rmId: string, date: string): RankedClient[] {
  const rows: Omit<RankedClient, "rank" | "priority" | "change">[] = [];
  for (const client of dataSet.clients.filter((c) => c.rmId === rmId)) {
    const assessments: ThemeAssessment[] = [];
    for (const theme of themes) {
      const exposure = computeExposure(client, dataSet.holdings, theme);
      if (!isAffected(exposure)) continue;
      assessments.push({
        theme,
        exposure,
        factors: scoreExposure(client, exposure, date),
        nextStep: recommendNextStep(theme, exposure),
      });
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
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    priority: priorityForRank(index, rows.length),
    change: null,
  }));
}

function totalImpact(row: RankedClient): number {
  return [row.primary, ...row.others].reduce((sum, a) => sum + a.exposure.estImpactUsd, 0);
}

/**
 * The whole scan pipeline as one pure function. A scheduler would call it with
 * upTo "morning" before 9 AM; the Scan now button calls it with "intraday".
 */
export function runScan({ date, rmId, upTo }: ScanArgs, dataSet: DataSet = defaultData): ScanResult {
  const morningRead = itemsRead(dataSet.news, date, "morning");
  const morningThemes = activeThemes(dataSet, morningRead);
  const morningClients = rankClients(dataSet, morningThemes, rmId, date);

  const record: ScanResult["record"] = {
    completedAt: SCAN_TIME,
    deliveredAt: DELIVERY_TIME,
    itemsRead: morningRead.length,
    sourceCount: new Set(morningRead.map((n) => n.source)).size,
    relevantCount: morningRead.filter((n) => n.relevant).length,
    themeCount: morningThemes.length,
    affectedClientCount: morningClients.length,
    adHoc: null,
  };
  const clientCount = dataSet.clients.filter((c) => c.rmId === rmId).length;

  if (upTo === "morning") {
    return {
      date,
      rmId,
      upTo,
      record,
      news: morningRead,
      themes: morningThemes,
      clients: morningClients,
      clientCount,
      prospectThemes: selectProspectThemes(morningThemes, dataSet.products),
    };
  }

  const read = itemsRead(dataSet.news, date, "intraday");
  const themes = activeThemes(dataSet, read);
  const newItems = read.filter((n) => n.batch === "intraday");
  const before = new Map(morningClients.map((row) => [row.client.id, row]));

  const clients = rankClients(dataSet, themes, rmId, date).map((row) => {
    const previous = before.get(row.client.id);
    const change = previous
      ? {
          isNew: false,
          rankDelta: previous.rank - row.rank,
          impactChanged: Math.abs(totalImpact(previous) - totalImpact(row)) > 0.5,
        }
      : { isNew: true, rankDelta: 0, impactChanged: true };
    const changed = change.isNew || change.rankDelta !== 0 || change.impactChanged;
    return { ...row, change: changed ? change : null };
  });

  return {
    date,
    rmId,
    upTo,
    record: {
      ...record,
      adHoc: {
        at: AD_HOC_TIME,
        newItems: newItems.length,
        newRelevant: newItems.filter((n) => n.relevant).length,
        newThemes: themes.filter((t) => t.status === "new").length,
        updatedThemes: themes.filter((t) => t.status === "updated").length,
        themeCount: themes.length,
        affectedClientCount: clients.length,
      },
    },
    news: read,
    themes,
    clients,
    clientCount,
    prospectThemes: selectProspectThemes(themes, dataSet.products),
  };
}
