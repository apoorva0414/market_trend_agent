import type { Client, Holding, HoldingImpact, TagMove, ThemeExposure } from "../types";

/** A client is "affected" by a theme when at least this share of AUM is exposed to it. */
export const AFFECTED_THRESHOLD = 0.03;

/**
 * Exposure and estimated impact of one theme on one client (spec 6.2).
 * A holding counts once, using the move of the first theme tag it carries.
 */
export function computeExposure(
  client: Client,
  holdings: Holding[],
  theme: { id: string; affectedTags: TagMove[] },
): ThemeExposure {
  const matched: HoldingImpact[] = [];
  for (const holding of holdings) {
    if (holding.clientId !== client.id) continue;
    const move = theme.affectedTags.find((t) => holding.tags.includes(t.tag));
    if (!move) continue;
    matched.push({
      holding,
      tag: move.tag,
      estMovePct: move.estMovePct,
      estImpactUsd: (holding.marketValueUsd * move.estMovePct) / 100,
      pctOfAum: holding.marketValueUsd / client.aumUsd,
    });
  }
  matched.sort((a, b) => b.holding.marketValueUsd - a.holding.marketValueUsd);
  const exposureUsd = matched.reduce((sum, m) => sum + m.holding.marketValueUsd, 0);
  const estImpactUsd = matched.reduce((sum, m) => sum + m.estImpactUsd, 0);
  return {
    themeId: theme.id,
    exposureUsd,
    exposurePct: exposureUsd / client.aumUsd,
    estImpactUsd,
    estImpactPct: estImpactUsd / client.aumUsd,
    holdings: matched,
  };
}

export function isAffected(exposure: ThemeExposure): boolean {
  return exposure.exposurePct >= AFFECTED_THRESHOLD;
}
