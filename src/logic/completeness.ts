import { daysBetween } from "./scoring";

// Check completeness (spec 2.2): one rule-based pass over a hand-off, no AI involved.
// Each gap comes with a starter sentence that the "Add" link drops into the context box.

export interface Gap {
  id: string;
  message: string;
  starter: string;
}

export const READY_MESSAGE = "Ready to hand off.";
export const STALE_CONTACT_DAYS = 90;

export const CONTEXT_CHIPS = {
  "portfolio-review": [
    { label: "Client already raised this concern", starter: "The client already raised this concern: " },
    { label: "Client wants to reduce risk", starter: "The client wants to reduce risk: " },
    { label: "Family account: who decides", starter: "Family account: decisions are made by " },
    { label: "Liquidity need coming up", starter: "Liquidity need coming up: " },
  ],
  proposal: [
    { label: "Prospect introduced by…", starter: "Prospect introduced by " },
    { label: "Prospect's current bank / adviser", starter: "Current bank / adviser: " },
    { label: "Budget and timeline", starter: "Budget and timeline: " },
    { label: "Prospect's main concern", starter: "Main concern: " },
  ],
} as const;

/** True when the text mentions the topic and says something about it, not just the bare starter. */
function covers(text: string, topic: RegExp): boolean {
  const match = topic.exec(text);
  if (!match) return false;
  const rest = text.slice(match.index + match[0].length).split("\n")[0];
  return /[\p{L}\p{N}]{2,}/u.test(rest);
}

export function checkPortfolioReview(
  client: { banks: string[]; lastContactDate: string; notes?: string },
  rmContext: string,
  date: string,
): Gap[] {
  const context = rmContext.trim();
  const gaps: Gap[] = [];

  if (context === "") {
    gaps.push({ id: "context", message: "RM context is empty. Add what the next agent should know.", starter: "" });
  }

  const days = daysBetween(client.lastContactDate, date);
  if (days > STALE_CONTACT_DAYS && !covers(context, /risk profile(?: is| was| has been|:)?/i)) {
    gaps.push({
      id: "risk-profile",
      message: `Last contact was ${days} days ago. Confirm the risk profile is still current.`,
      starter: "Risk profile is ",
    });
  }

  if (client.notes && /family account/i.test(client.notes) && !covers(context, /decisions? (are|is) made by|decision[- ]maker( is)?|who decides:?|decided by/i)) {
    gaps.push({
      id: "family",
      message: "Family account. Say who decides and whom to contact.",
      starter: "Family account: decisions are made by ",
    });
  }

  if (client.banks.length > 1 && !covers(context, /holdings (across|at)[^\n]*? (are|is)|holdings (are|is)/i)) {
    const banks = client.banks.join(" and ");
    gaps.push({
      id: "banks",
      message: `Client uses ${client.banks.length} banks (${banks}). Confirm the holdings are complete.`,
      starter: `Holdings across ${banks} are `,
    });
  }

  return gaps;
}

const AMOUNT = /(?:\b(?:SGD|USD|EUR|GBP|HKD|CHF|AUD|JPY|RMB|CNY)|S\$|US\$|\$|€|£)\s?\d|\b\d+(?:[.,]\d+)?\s?(?:k|m|mn|mio|million|bn|billion)\b/i;
const RISK_APPETITE =
  /\b(conservative|cautious|defensive|balanced|moderate|growth|aggressive|risk[- ]averse|risk appetite|risk tolerance|capital preservation|income[- ](?:focused|oriented|seeking))\b/i;
const MIN_PROFILE_WORDS = 10;

export function checkProposal(profile: string, rmContext: string): Gap[] {
  const description = `${profile}\n${rmContext}`.trim();
  const gaps: Gap[] = [];

  if (!AMOUNT.test(description)) {
    gaps.push({ id: "budget", message: "No budget or amount for the prospect.", starter: "Budget and timeline: " });
  }
  if (!RISK_APPETITE.test(description)) {
    gaps.push({ id: "risk", message: "No risk appetite stated.", starter: "Risk appetite: " });
  }
  if (!covers(description, /introduced by/i)) {
    gaps.push({ id: "introduced", message: "No \"introduced by\": say how the prospect came to us.", starter: "Prospect introduced by " });
  }
  const words = description.split(/[\s,;:/]+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  if (words < MIN_PROFILE_WORDS) {
    gaps.push({
      id: "profile",
      message: `The prospect description is only ${words} words. Add more about who they are.`,
      starter: "About the prospect: ",
    });
  }

  return gaps;
}

/** For the activity log: "sent with 2 open gaps". */
export function gapSummary(gaps: Gap[]): string {
  if (gaps.length === 0) return "sent with no open gaps";
  return `sent with ${gaps.length} open ${gaps.length === 1 ? "gap" : "gaps"}`;
}
