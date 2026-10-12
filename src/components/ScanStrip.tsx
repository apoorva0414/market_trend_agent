import { useEffect, useState } from "react";
import { DELIVERY_TIME } from "../data";
import { fmtTimeSgt, plural } from "../logic/format";
import { useApp } from "../state/AppContext";
import { AgentLabel, agentTint, buttonPrimary } from "./ui";

const STEPS = [
  `Reading new items since ${DELIVERY_TIME}…`,
  "Filtering to market-moving items…",
  "Updating themes…",
  "Re-ranking your clients…",
];
const STEP_MS = 900;

/** Scan record for the scheduled run, plus the ad hoc Scan now control (spec 6.1). */
export function ScanStrip() {
  const { scan, upTo, scanNow, resetToMorning } = useApp();
  const { record } = scan;
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (step === null) return;
    const timer = window.setTimeout(() => {
      if (step < STEPS.length - 1) {
        setStep(step + 1);
      } else {
        setStep(null);
        scanNow();
      }
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [step, scanNow]);

  const scanning = step !== null;
  const adHoc = record.adHoc;
  const changedRows = scan.clients.filter((row) => row.change).length;

  return (
    <section aria-label="Scan record" className={`rounded-lg p-5 ${agentTint}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <AgentLabel />
          <p className="mt-1.5 text-sm font-medium text-ink">
            Automatic scan completed {record.completedAt} SGT · {plural(record.itemsRead, "item")} read from {plural(record.sourceCount, "source")} ·{" "}
            {record.relevantCount} relevant · {plural(record.themeCount, "theme")} · {record.affectedClientCount} of your clients affected
          </p>
          <p className="mt-1 text-xs text-muted">Runs every business day · Brief delivered {record.deliveredAt} SGT</p>

          {adHoc && !scanning && (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-brand/40 pt-3 text-sm font-medium text-ink">
              <span>
                Ad hoc scan {adHoc.at} SGT · {plural(adHoc.newItems, "new item")} · now {plural(adHoc.themeCount, "theme")} · {adHoc.affectedClientCount} of
                your clients affected
              </span>
              <button type="button" onClick={resetToMorning} className="text-sm font-medium text-brand-tint underline underline-offset-2 hover:text-white">
                Reset to 9 AM brief
              </button>
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <button type="button" className={buttonPrimary} disabled={scanning || upTo === "intraday"} onClick={() => setStep(0)}>
            <svg viewBox="0 0 16 16" className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} aria-hidden="true">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M13.8 1.8v3h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {scanning ? "Scanning…" : "Scan now"}
          </button>
          <span className="text-xs text-muted">
            {upTo === "intraday" && !scanning ? `Up to date as of ${adHoc?.at} SGT` : "Pick up new developments at any time"}
          </span>
        </div>
      </div>

      {scanning && (
        <div className="mt-4 rounded-md border border-brand/40 bg-surface p-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">{STEPS[step]}</span>
            <span className="text-xs text-muted">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((label, index) => (
              <div key={label} className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand/25">
                {index < step && <div className="h-full w-full bg-brand-hover" />}
                {index === step && <div className="h-full bg-brand-hover" style={{ animation: `scan-progress ${STEP_MS}ms linear forwards` }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="font-medium text-brand-tint select-none hover:text-white">What the agent did</summary>
        <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <div>
            <ol className="list-decimal space-y-1.5 pl-5 text-soft marker:text-muted">
              <li>
                Read {plural(record.itemsRead, "item")} from {plural(record.sourceCount, "source")}
              </li>
              <li>Filtered to {record.relevantCount} market-moving items</li>
              <li>Grouped them into {plural(record.themeCount, "theme")}</li>
              <li>Matched themes to your clients' holdings</li>
              <li>Delivered your brief at {record.deliveredAt}</li>
            </ol>
            {adHoc && (
              <>
                <p className="mt-4 mb-1.5 text-xs font-semibold tracking-widest text-muted uppercase">Ad hoc scan at {adHoc.at}</p>
                <ol start={6} className="list-decimal space-y-1.5 pl-5 text-soft marker:text-muted">
                  <li>
                    Read {plural(adHoc.newItems, "new item")} since {record.deliveredAt}
                  </li>
                  <li>Kept {adHoc.newRelevant} as market-moving</li>
                  <li>
                    Updated {plural(adHoc.updatedThemes, "theme")} and added {plural(adHoc.newThemes, "new theme")}
                  </li>
                  <li>Re-ranked your clients: {plural(changedRows, "row")} changed</li>
                </ol>
              </>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-widest text-muted uppercase">Items read</p>
            <ul className="divide-y divide-line rounded-md border border-line bg-surface">
              {scan.news.map((item) => (
                <li key={item.id} className="flex items-baseline gap-3 px-3 py-2">
                  <span className="w-10 shrink-0 text-xs text-muted tabular-nums">{fmtTimeSgt(item.publishedAt)}</span>
                  <span className={`min-w-0 flex-1 ${item.relevant ? "text-soft" : "text-muted line-through"}`}>{item.headline}</span>
                  <span className="hidden shrink-0 text-xs text-muted sm:block">{item.source}</span>
                  <span className={`w-20 shrink-0 text-right text-xs font-medium ${item.relevant ? "text-brand-tint" : "text-muted"}`}>
                    {item.relevant ? (item.batch === "intraday" ? "New" : "Relevant") : "Filtered out"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}
