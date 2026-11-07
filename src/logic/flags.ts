import type { TagMove, ThemeExposure } from "../types";

const STRUCTURED_NOTE_TAG = "structured-notes-tech-underlying";

/**
 * Barrier risk: the theme moves structured notes on tech underlyings and the client holds one.
 * The talking points then explain the maturity scenarios.
 */
export function barrierFlag(theme: { affectedTags: TagMove[] }, exposure: ThemeExposure): "Barrier risk" | undefined {
  const themeMovesNotes = theme.affectedTags.some((t) => t.tag === STRUCTURED_NOTE_TAG);
  const holdsNote = exposure.holdings.some((h) => h.holding.tags.includes(STRUCTURED_NOTE_TAG));
  return themeMovesNotes && holdsNote ? "Barrier risk" : undefined;
}
