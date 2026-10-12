import type { RefineRequest, TalkingPointsWording } from "../types.ts";

// Locked facts (spec 1.3). Client name, holdings, amounts, percentages and estimated impacts come
// from portfolio data. Chat can reword around them but can never introduce a figure of its own.
// This module is shared by the browser and the refine endpoint, so both enforce the same rule.

export const FIGURES_NOTICE = "Kept the original figures. Numbers come from the portfolio data.";

export const WORDING_FIELDS = ["summary", "talkingPoints", "nextSteps"] as const satisfies readonly (keyof TalkingPointsWording)[];

/** Every number in a text, normalised so "1,500", "1500.0" and full-width digits compare equal. */
export function extractNumbers(text: string): string[] {
  const ascii = text.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
  const matches = ascii.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return matches.map((raw) => String(Number.parseFloat(raw.replace(/,/g, ""))));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** A day number followed by a month name, e.g. "12 November" or "9 Oct". Captures the first three letters of the month. */
const DATE_WITH_MONTH_NAME = /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi;

/** The numbers that exist in the source data: locked facts, theme, client, house view and the current text. */
export function allowedNumbers(
  request: Pick<RefineRequest, "factsLocked" | "theme" | "client" | "houseView" | "currentDoc">,
): Set<string> {
  const { factsLocked, theme, client, houseView, currentDoc } = request;
  const source = JSON.stringify([factsLocked, theme, client, houseView, currentDoc]);
  const allowed = new Set(extractNumbers(source));
  // A date written as "12 November 2026" may be written with a numeric month, as Chinese does.
  for (const match of source.matchAll(DATE_WITH_MONTH_NAME)) {
    allowed.add(String(MONTHS.indexOf(match[1].toLowerCase()) + 1));
  }
  return allowed;
}

function fieldText(wording: TalkingPointsWording, field: keyof TalkingPointsWording): string {
  const value = wording[field];
  return Array.isArray(value) ? value.join("\n") : value;
}

/**
 * Field by field: if the proposed text contains a number that is not in the source data,
 * keep the previous text for that field.
 */
export function enforceLockedFigures(
  previous: TalkingPointsWording,
  proposed: TalkingPointsWording,
  allowed: Set<string>,
): { wording: TalkingPointsWording; rejectedFields: (keyof TalkingPointsWording)[] } {
  const rejectedFields: (keyof TalkingPointsWording)[] = [];
  const wording: TalkingPointsWording = { ...proposed };
  for (const field of WORDING_FIELDS) {
    const invented = extractNumbers(fieldText(proposed, field)).some((number) => !allowed.has(number));
    if (!invented) continue;
    rejectedFields.push(field);
    if (field === "summary") wording.summary = previous.summary;
    else wording[field] = previous[field];
  }
  return { wording, rejectedFields };
}

// Requests to forecast or guarantee a return are refused before any rewrite is attempted.
// The number check alone cannot catch "say the note will gain 20%" when 20% happens to
// appear elsewhere in the client's data.
const GUARANTEE = /\b(guarantee\w*|promise\w*|risk[- ]free|can(?:'|no)?t lose|sure to|certain to|bound to|no risk)\b/i;
const FORECAST =
  /\b(will|would|going to|gonna|shall|expect(?:ed)? to|should)\b[^.?!]{0,60}\b(gain|rise|rally|recover|rebound|return|go up|increase|appreciate|double|outperform|earn|profit|bounce)\b/i;

export const REFUSAL_REPLY = "I can't write that. I don't invent figures or promise returns, so the draft is unchanged.";

/** True when the instruction asks for a predicted or guaranteed return. */
export function asksForPromisedReturn(instruction: string): boolean {
  return GUARANTEE.test(instruction) || (FORECAST.test(instruction) && /\d/.test(instruction));
}

export function sameWording(a: TalkingPointsWording, b: TalkingPointsWording): boolean {
  return (
    a.summary === b.summary &&
    a.talkingPoints.length === b.talkingPoints.length &&
    a.nextSteps.length === b.nextSteps.length &&
    a.talkingPoints.every((point, index) => point === b.talkingPoints[index]) &&
    a.nextSteps.every((step, index) => step === b.nextSteps[index])
  );
}
