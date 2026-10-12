import type { Tag } from "../types";

const MINUS = "−";

function trim(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function sign(value: number, signed: boolean): string {
  if (value < 0) return MINUS;
  return signed && value > 0 ? "+" : "";
}

/** "USD 4.35m", "USD 158k". With signed: "+USD 258k", "−USD 158k". */
export function fmtUsd(value: number, signed = false): string {
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_000_000) body = `${trim(abs / 1_000_000, 2)}m`;
  else if (abs >= 100_000) body = `${Math.round(abs / 1000)}k`;
  else if (abs >= 1000) body = `${trim(abs / 1000, 1)}k`;
  else body = `${Math.round(abs)}`;
  return `${sign(value, signed)}USD ${body}`;
}

/** Takes a fraction: 0.351 becomes "35.1%". */
export function fmtPct(fraction: number, digits = 1, signed = false): string {
  return `${sign(fraction, signed)}${Math.abs(fraction * 100).toFixed(digits)}%`;
}

/** Takes a percentage move: -3.5 becomes "−3.5%". */
export function fmtMove(pct: number): string {
  return `${sign(pct, true)}${trim(Math.abs(pct), 1)}%`;
}

export function fmtScore(value: number): string {
  return value.toFixed(2);
}

function parts(iso: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const date = new Date(iso.slice(0, 10) + "T00:00:00Z");
  const formatted = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).formatToParts(date);
  return Object.fromEntries(formatted.map((p) => [p.type, p.value]));
}

/** "Monday, 12 October 2026" */
export function fmtDateLong(iso: string): string {
  const p = parts(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

/** "Mon 12 Oct" */
export function fmtDateShort(iso: string): string {
  const p = parts(iso, { weekday: "short", day: "numeric", month: "short" });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "12 Oct 2026" */
export function fmtDateMedium(iso: string): string {
  const p = parts(iso, { day: "numeric", month: "short", year: "numeric" });
  return `${p.day} ${p.month} ${p.year}`;
}

/** Time of day in Singapore for an ISO timestamp: "13:10". */
export function fmtTimeSgt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Singapore",
  }).format(new Date(iso));
}

/** "12 Oct 2026, 13:10:05" in Singapore time, for the activity log. */
export function fmtTimestampSgt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Singapore",
  }).format(new Date(iso));
}

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export const TAG_LABEL: Record<Tag, string> = {
  "us-tech": "US tech equity",
  "us-tech-credit": "US tech credit",
  "long-duration-usd-bonds": "long-duration USD bonds",
  "short-duration-bonds": "short-duration bonds",
  reits: "REITs",
  energy: "energy",
  airlines: "airlines",
  "china-equity": "China equity",
  "hk-equity": "Hong Kong equity",
  "asia-credit": "Asia credit",
  gold: "gold",
  "usd-cash": "USD cash",
  "sgd-cash": "SGD cash",
  "structured-notes-tech-underlying": "structured notes on tech underlyings",
  "called-usd-perpetual": "the called USD perpetual",
};

/** "2 October", for sentences that mention a date. */
export function fmtDayMonth(iso: string): string {
  const p = parts(iso, { day: "numeric", month: "long" });
  return `${p.day} ${p.month}`;
}

/** Numeric month and day, for Chinese date wording. */
export function monthAndDay(iso: string): { month: number; day: number } {
  return { month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) };
}
