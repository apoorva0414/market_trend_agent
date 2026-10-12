import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DocumentView } from "../components/DocumentView";
import { buttonPrimary, buttonSecondary, card, eyebrow } from "../components/ui";
import { portfolioReviewToDoc, proposalToDoc } from "../documents/model";
import { fmtTimestampSgt } from "../logic/format";
import { useApp } from "../state/AppContext";
import type { Handoff } from "../types";

const TITLE: Record<Handoff["kind"], string> = {
  "portfolio-review": "Portfolio Review solution, coming next",
  proposal: "Portfolio Proposal solution, coming next",
};

const NEXT_AGENT: Record<Handoff["kind"], string> = {
  "portfolio-review": "The Portfolio Review agent will continue from here, with its own chat.",
  proposal: "The Proposal agent will continue from here, with its own chat.",
};

/** Placeholder for the two downstream solutions: shows the hand-off they would receive (spec 7.5). */
export function Stub({ kind }: { kind: Handoff["kind"] }) {
  const { handoffId } = useParams();
  const { handoffs } = useApp();
  const [copied, setCopied] = useState(false);
  const handoff = handoffId ? handoffs[handoffId] : undefined;

  if (!handoff || handoff.kind !== kind) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">{TITLE[kind]}</h1>
        <p className="mt-3 text-muted">No hand-off with the reference {handoffId} has been received in this browser.</p>
        <Link to="/brief" className={`${buttonPrimary} mt-6`}>
          Open the brief
        </Link>
      </div>
    );
  }

  const model = handoff.kind === "portfolio-review" ? portfolioReviewToDoc(handoff) : proposalToDoc(handoff);
  const json = JSON.stringify(handoff, null, 2);
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The payload stays visible below and can be selected by hand.
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-8">
      <div>
        <Link to="/act" className="text-sm font-medium text-brand-tint hover:text-white">
          ← Back to your actions
        </Link>
        <p className={`${eyebrow} mt-4`}>Separate solution · placeholder page</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight text-ink">{TITLE[kind]}</h1>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-gain/40 bg-gain/12 px-5 py-4">
        <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-gain" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6 10.4l2.6 2.6L14 7.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="text-sm text-soft">
          <p className="font-semibold text-gain">Hand-off received</p>
          <p className="mt-0.5 text-ink">{NEXT_AGENT[kind]}</p>
          <p className="mt-1.5">
            Reference {handoff.handoffId} · from {handoff.rm.name} · {fmtTimestampSgt(handoff.createdAt)} SGT
          </p>
          <p className="mt-0.5">
            {handoff.openGaps.length === 0
              ? "Completeness check: no open gaps."
              : `Completeness check: ${handoff.openGaps.length} open ${handoff.openGaps.length === 1 ? "gap" : "gaps"}, listed under RM context.`}
          </p>
        </div>
      </div>

      <DocumentView model={model} />

      <details className={card}>
        <summary className="px-5 py-3.5 text-sm font-semibold text-ink select-none">Structured payload (JSON), as the next agent would read it</summary>
        <div className="border-t border-line p-5">
          <button type="button" className={buttonSecondary} onClick={copyJson}>
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <pre className="mt-3 max-h-[32rem] overflow-auto rounded-md border border-line bg-bg p-4 text-xs leading-relaxed text-soft">{json}</pre>
        </div>
      </details>
    </div>
  );
}
