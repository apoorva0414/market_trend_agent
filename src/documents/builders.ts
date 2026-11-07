import { type DataSet, HOLDINGS_AS_OF } from "../data";
import { joinList, TAG_LABEL } from "../logic/format";
import type { ActiveTheme, DocHeader, DocHoldingLine, HouseViewEntry, Rm, Tag, ThemeExposure } from "../types";

export const DISCLAIMER = "[Azimut standard Singapore disclaimer, to be supplied by Compliance]";

export interface BuildContext {
  rm: Rm;
  date: string;
  dataSet?: DataSet;
}

// ---------- shared pieces ----------

export function roundedPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Tags the client actually holds for this theme, largest first, as readable labels. */
export function exposedTags(exposure: ThemeExposure): Tag[] {
  const byTag = new Map<Tag, number>();
  for (const h of exposure.holdings) byTag.set(h.tag, (byTag.get(h.tag) ?? 0) + h.holding.marketValueUsd);
  return [...byTag.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

export function exposureLabels(exposure: ThemeExposure): string {
  return joinList(exposedTags(exposure).map((tag) => TAG_LABEL[tag]));
}

export function houseViewsFor(exposure: ThemeExposure, houseView: HouseViewEntry[]): HouseViewEntry[] {
  const found: HouseViewEntry[] = [];
  for (const tag of exposedTags(exposure)) {
    const entry = houseView.find((h) => h.tags.includes(tag));
    if (entry && !found.includes(entry)) found.push(entry);
  }
  return found;
}

export function holdingLines(exposure: ThemeExposure): DocHoldingLine[] {
  return exposure.holdings.map((h) => ({
    instrument: h.holding.instrument,
    assetClass: h.holding.assetClass,
    bank: h.holding.bank,
    currency: h.holding.currency,
    marketValueUsd: h.holding.marketValueUsd,
    pctOfAum: h.pctOfAum,
    estMovePct: h.estMovePct,
    estImpactUsd: h.estImpactUsd,
  }));
}

/** Position of the affected holdings against what was paid for them, after the estimated move. */
export function versusCost(exposure: ThemeExposure): number {
  const cost = exposure.holdings.reduce((sum, h) => sum + h.holding.costBasisUsd, 0);
  if (cost === 0) return 0;
  return (exposure.exposureUsd + exposure.estImpactUsd - cost) / cost;
}

export function header(
  subject: string,
  theme: ActiveTheme,
  whyNow: string,
  ctx: BuildContext,
): DocHeader {
  return {
    subjectKind: "Client",
    subject,
    themeTitle: theme.title,
    themeType: theme.type,
    whyNow,
    dataAsOf: HOLDINGS_AS_OF,
    preparedFor: ctx.rm.name,
    date: ctx.date,
  };
}

export function compactDate(date: string): string {
  return date.replaceAll("-", "");
}
