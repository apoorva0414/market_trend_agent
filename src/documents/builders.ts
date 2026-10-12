import { data as defaultData, type DataSet, HOLDINGS_AS_OF } from "../data";
import { fmtPct, fmtUsd, joinList, TAG_LABEL } from "../logic/format";
import type {
  ActiveTheme,
  Client,
  DocHeader,
  DocHoldingLine,
  DocProductLine,
  HouseViewEntry,
  PortfolioReviewHandoff,
  ProposalHandoff,
  ProspectTheme,
  RankedClient,
  RiskProfile,
  Rm,
  Tag,
  ThemeExposure,
} from "../types";

export const DISCLAIMER = "[Azimut standard Singapore disclaimer, to be supplied by Compliance]";
export const NO_PROFILE = "Prospect profile not specified";

/** Highest shelf risk level that is shown as an option for each risk profile. */
const MAX_RISK_LEVEL: Record<RiskProfile, number> = {
  Conservative: 2,
  Balanced: 3,
  Growth: 4,
  Aggressive: 5,
};

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

export function productLines(theme: ActiveTheme, dataSet: DataSet, client?: Client): DocProductLine[] {
  return theme.relevantProductIds
    .map((id) => dataSet.products.find((p) => p.id === id))
    .filter((p) => !!p)
    .filter((p) => !client || p.riskLevel <= MAX_RISK_LEVEL[client.riskProfile])
    .map((p) => ({
      productId: p.id,
      name: p.name,
      assetClass: p.assetClass,
      riskLevel: p.riskLevel,
      oneLiner: p.oneLiner,
    }));
}

/** Position of the affected holdings against what was paid for them, after the estimated move. */
export function versusCost(exposure: ThemeExposure): number {
  const cost = exposure.holdings.reduce((sum, h) => sum + h.holding.costBasisUsd, 0);
  if (cost === 0) return 0;
  return (exposure.exposureUsd + exposure.estImpactUsd - cost) / cost;
}

export function header(
  subjectKind: DocHeader["subjectKind"],
  subject: string,
  theme: ActiveTheme,
  whyNow: string,
  ctx: BuildContext,
): DocHeader {
  return {
    subjectKind,
    subject,
    themeTitle: theme.title,
    themeType: theme.type,
    whyNow,
    dataAsOf: HOLDINGS_AS_OF,
    preparedFor: ctx.rm.name,
    date: ctx.date,
  };
}

function themeSummary(theme: ActiveTheme) {
  return {
    id: theme.id,
    title: theme.title,
    type: theme.type,
    whatHappened: theme.updateNote ? `${theme.whatHappened} ${theme.updateNote}` : theme.whatHappened,
    whyItMatters: theme.whyItMatters,
    ...(theme.stressTest ? { stressTest: theme.stressTest } : {}),
  };
}

export function compactDate(date: string): string {
  return date.replaceAll("-", "");
}

// ---------- 8.2 Portfolio Review hand-off (internal) ----------

export function portfolioReviewId(clientId: string, themeId: string, date: string): string {
  return `PR-${compactDate(date)}-${clientId}-${themeId.replace("theme-", "")}`;
}

export function buildPortfolioReviewHandoff(
  row: RankedClient,
  ctx: BuildContext,
  rmContext = "",
  openGaps: string[] = [],
  createdAt = new Date().toISOString(),
): PortfolioReviewHandoff {
  const dataSet = ctx.dataSet ?? defaultData;
  const { client, primary, others } = row;
  const { theme, exposure, nextStep } = primary;
  const share = roundedPct(exposure.exposurePct);
  const labels = exposureLabels(exposure);
  const impact = `${fmtUsd(exposure.estImpactUsd, true)} (${fmtPct(exposure.estImpactPct, 2, true)} of AUM)`;
  const views = houseViewsFor(exposure, dataSet.houseView);
  const vsCost = versusCost(exposure);
  const banks = [...new Set(exposure.holdings.map((h) => h.holding.bank))];

  const whyNow = `About ${share} of the client's portfolio (${fmtUsd(exposure.exposureUsd)}) is in ${labels}, with an estimated impact of ${impact}.`;

  const pointsToCover: string[] = [
    `Concentration: ${share} of AUM (${fmtUsd(exposure.exposureUsd)}) sits in ${labels}, against a ${client.riskProfile.toLowerCase()} risk profile.`,
    `Estimated impact: ${impact}, based on indicative moves. Confirm against bank statements before the review.`,
    ...views.slice(0, 2).map((v) => `House view on ${v.assetClass}: ${v.stance}. ${v.view}`),
    `Position against cost: the affected holdings are about ${Math.abs(Math.round(vsCost * 100))}% ${vsCost >= 0 ? "above" : "below"} purchase cost after this move.`,
  ];
  if (banks.length > 1) {
    pointsToCover.push(`Custody: the affected holdings are split across ${joinList(banks)}, so the review needs a consolidated view.`);
  }
  if (others.length > 0) {
    pointsToCover.push(
      `Other themes touching this portfolio: ${joinList(others.map((o) => `${o.theme.title} (${fmtUsd(o.exposure.estImpactUsd, true)})`))}.`,
    );
  }
  pointsToCover.push(
    client.mandate === "Discretionary"
      ? "Discretionary mandate: decide whether to rebalance within the mandate, and how the client will be kept informed."
      : "Advisory mandate: any change needs the client's agreement, so prepare a recommendation with alternatives.",
  );

  const likelyClientQuestions = [
    ...theme.likelyQuestions,
    client.mandate === "Discretionary" ? "What are you doing about it on my behalf?" : "What would you do in my position?",
  ];

  return {
    handoffId: portfolioReviewId(client.id, theme.id, ctx.date),
    kind: "portfolio-review",
    createdAt,
    header: header("Client", client.name, theme, whyNow, ctx),
    rm: { id: ctx.rm.id, name: ctx.rm.name },
    client: {
      id: client.id,
      name: client.name,
      mandate: client.mandate,
      riskProfile: client.riskProfile,
      banks: client.banks,
      aumUsd: client.aumUsd,
      lastContactDate: client.lastContactDate,
      ...(client.notes ? { notes: client.notes } : {}),
    },
    theme: themeSummary(theme),
    exposure: {
      exposureUsd: exposure.exposureUsd,
      exposurePct: exposure.exposurePct,
      estImpactUsd: exposure.estImpactUsd,
      estImpactPct: exposure.estImpactPct,
    },
    recommendation: { action: nextStep.action, reason: nextStep.reason },
    affectedHoldings: holdingLines(exposure),
    otherThemes: others.map((o) => ({
      id: o.theme.id,
      title: o.theme.title,
      exposurePct: o.exposure.exposurePct,
      estImpactUsd: o.exposure.estImpactUsd,
    })),
    pointsToCover,
    likelyClientQuestions,
    optionsToDiscuss: productLines(theme, dataSet, client),
    rmContext: rmContext.trim(),
    openGaps,
  };
}

// ---------- 8.3 Proposal hand-off (internal) ----------

export function proposalId(rmId: string, themeId: string, date: string): string {
  return `PP-${compactDate(date)}-${rmId.replace("rm-", "")}-${themeId.replace("theme-", "")}`;
}

export function buildProposalHandoff(
  prospect: ProspectTheme,
  profile: string,
  ctx: BuildContext,
  rmContext = "",
  openGaps: string[] = [],
  createdAt = new Date().toISOString(),
): ProposalHandoff {
  const dataSet = ctx.dataSet ?? defaultData;
  const { theme } = prospect;
  const cleanProfile = profile.trim() || NO_PROFILE;
  return {
    handoffId: proposalId(ctx.rm.id, theme.id, ctx.date),
    kind: "proposal",
    createdAt,
    header: header("Prospect", cleanProfile, theme, theme.prospectAngle, ctx),
    rm: { id: ctx.rm.id, name: ctx.rm.name },
    theme: themeSummary(theme),
    prospectFit: { profile: cleanProfile, suits: theme.prospectSuits, angle: theme.prospectAngle },
    products: productLines(theme, dataSet),
    keyRisks: theme.keyRisks,
    rmContext: rmContext.trim(),
    openGaps,
  };
}
