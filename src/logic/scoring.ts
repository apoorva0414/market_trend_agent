import type { Client, Mandate, Priority, RiskProfile, ScoreFactors, ThemeExposure } from "../types";

export const RISK_WEIGHT: Record<RiskProfile, number> = {
  Conservative: 1.3,
  Balanced: 1.1,
  Growth: 1.0,
  Aggressive: 0.9,
};

export const MANDATE_WEIGHT: Record<Mandate, number> = {
  Discretionary: 1.2,
  Advisory: 1.0,
};

export const CONTACT_STALE_DAYS = 30;

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso.slice(0, 10) + "T00:00:00Z");
  const to = Date.parse(toIso.slice(0, 10) + "T00:00:00Z");
  return Math.round((to - from) / 86_400_000);
}

/** Priority score for one client and theme (spec 6.3). */
export function scoreExposure(client: Client, exposure: ThemeExposure, date: string): ScoreFactors {
  const base = Math.abs(exposure.estImpactPct) * 100;
  const riskWeight = RISK_WEIGHT[client.riskProfile];
  const mandateWeight = MANDATE_WEIGHT[client.mandate];
  const lossWeight = exposure.estImpactUsd < 0 ? 1.2 : 1.0;

  const daysSinceContact = daysBetween(client.lastContactDate, date);
  let contactReason: string | null = null;
  if (daysSinceContact > CONTACT_STALE_DAYS) contactReason = `last contact ${daysSinceContact} days ago`;
  else if (client.prefersFrequentUpdates) contactReason = "prefers frequent updates";
  const contactBoost = contactReason ? 1.1 : 1.0;

  return {
    base,
    riskWeight,
    mandateWeight,
    lossWeight,
    contactBoost,
    contactReason,
    score: base * riskWeight * mandateWeight * lossWeight * contactBoost,
  };
}

/** High = top third of the ranked list, Medium = middle third, Low = bottom third. */
export function priorityForRank(index: number, total: number): Priority {
  if (index < Math.ceil(total / 3)) return "High";
  if (index < Math.ceil((2 * total) / 3)) return "Medium";
  return "Low";
}
