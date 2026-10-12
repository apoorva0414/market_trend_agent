import type { ActiveTheme, Product, ProspectTheme } from "../types";

/**
 * Themes worth raising with prospects (spec 6.5): any theme with a positive estimated move
 * on at least one tag, plus the featured theme (China stimulus) always.
 */
export function selectProspectThemes(themes: ActiveTheme[], products: Product[]): ProspectTheme[] {
  const bestMove = (t: ActiveTheme) => Math.max(...t.affectedTags.map((a) => a.estMovePct));
  return themes
    .filter((t) => t.prospectFeatured || bestMove(t) > 0)
    .sort((a, b) => Number(!!b.prospectFeatured) - Number(!!a.prospectFeatured) || bestMove(b) - bestMove(a))
    .map((theme) => ({
      theme,
      featured: !!theme.prospectFeatured,
      products: theme.relevantProductIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => !!p),
    }));
}
