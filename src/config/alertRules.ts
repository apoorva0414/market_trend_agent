import type { PositionEventType } from "../types";

// Demo values. To be calibrated with RMs against past market days.
// The rule is firm-wide: the same for every RM. Per-RM or per-client thresholds are a later phase.
export const alertRules = {
  impactPctThreshold: -1.0, // A: estimated impact at or below -1.0% of AUM
  exposurePctThreshold: 10, // B: exposure at or above 10% of AUM ...
  movePctThreshold: -3.0, // ... and the theme's move on those holdings at or below -3%
  includeGains: false, // v1 alerts on losses only
  positionEventTypes: ["Call notice", "Downgrade", "Barrier proximity", "Default"] as PositionEventType[],
};

export type AlertRules = typeof alertRules;

const pct = (value: number) => `${Math.abs(value)}%`;

/** "How alerts work", written from the values above so the text never drifts from the rule. */
export function howAlertsWork(rules: AlertRules = alertRules): string {
  return (
    "You get an alert email when something on a client's specific holding happens (for example a call notice, downgrade or barrier risk), " +
    `or when today's news is estimated to cost a client ${pct(rules.impactPctThreshold)} or more of their portfolio, ` +
    `or hits ${pct(rules.exposurePctThreshold)} or more of their portfolio with a move of ${pct(rules.movePctThreshold)} or more. ` +
    "These are starting values and will be adjusted based on your feedback."
  );
}

/** "Why you received this" line for the Client Alert email, written from the values above. */
export function alertReasonLine(rules: AlertRules = alertRules): string {
  return (
    "Sent because these clients met the alert threshold: a specific event on a holding, " +
    `an estimated impact of ${pct(rules.impactPctThreshold)} of portfolio or more, ` +
    `or ${pct(rules.exposurePctThreshold)} or more of the portfolio in holdings hit by a move of ${pct(rules.movePctThreshold)} or more.`
  );
}
