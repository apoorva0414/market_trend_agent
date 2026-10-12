import type { ClientAction, NextStep, RankedClient, ThemeExposure, ThemeType, TagMove } from "../types";

export const CONCENTRATION_THRESHOLD = 0.25;
const STRUCTURED_NOTE_TAG = "structured-notes-tech-underlying";

/** Recommended next step (spec 6.4). Rules are checked in order; the first match wins. */
export function recommendNextStep(
  theme: { type: ThemeType; affectedTags: TagMove[] },
  exposure: ThemeExposure,
): NextStep {
  if (exposure.exposurePct >= CONCENTRATION_THRESHOLD && exposure.estImpactUsd < 0) {
    return { action: "Portfolio review", reason: "Concentrated exposure to a falling theme", rule: 1 };
  }
  // "Theme 2" is the only theme that moves structured notes on tech underlyings.
  const themeMovesNotes = theme.affectedTags.some((t) => t.tag === STRUCTURED_NOTE_TAG);
  const holdsNote = exposure.holdings.some((h) => h.holding.tags.includes(STRUCTURED_NOTE_TAG));
  if (themeMovesNotes && holdsNote) {
    return { action: "Talking points", reason: "Barrier risk, explain scenarios", rule: 2, flag: "Barrier risk" };
  }
  if (theme.type === "Pulse") {
    return { action: "Talking points", reason: "Factual update, can share directly", rule: 3 };
  }
  if (exposure.estImpactUsd > 0) {
    return { action: "Talking points", reason: "Positive move, consider rebalancing conversation", rule: 4 };
  }
  return { action: "Talking points", reason: "Moderate impact, a short update is enough", rule: 5 };
}

/** The action pre-selected at the checkpoint: the recommendation, except Low priority rows, which start on Skip (spec 7.3). */
export function defaultAction(row: RankedClient): ClientAction {
  return row.priority === "Low" ? "Skip" : row.primary.nextStep.action;
}
