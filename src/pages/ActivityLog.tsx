import { useState } from "react";
import { Link } from "react-router-dom";
import { buttonSecondary } from "../components/ui";
import { fmtTimestampSgt } from "../logic/format";
import { useApp } from "../state/AppContext";
import type { LogType } from "../types";

const TYPE_STYLE: Record<LogType, string> = {
  "Brief delivered": "border-line bg-transparent text-muted",
  "Alert sent": "border-checkpoint bg-checkpoint/10 text-checkpoint",
  "Talking points approved": "border-gain/50 bg-gain/12 text-gain",
  Shared: "border-gain/50 bg-transparent text-gain",
  "No contact needed": "border-line bg-raised text-soft",
  "Logged to Portfolio Review": "border-brand/60 bg-brand/25 text-brand-tint",
};

export function ActivityLog() {
  const { log, clearLog, resetDemo } = useApp();
  const [confirming, setConfirming] = useState<"clear" | "reset" | null>(null);
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight text-ink">Activity log</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            This log can also serve as evidence that discretionary clients were kept informed (to confirm with Compliance).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm text-soft">{confirming === "reset" ? "Reset the demo? This clears the log, today's review entries and drafts." : "Clear the activity log?"}</span>
              <button
                type="button"
                className={buttonSecondary}
                onClick={() => {
                  if (confirming === "reset") resetDemo();
                  else clearLog();
                  setConfirming(null);
                }}
              >
                Yes, {confirming === "reset" ? "reset" : "clear"}
              </button>
              <button type="button" className={buttonSecondary} onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {log.length > 0 && (
                <button type="button" className={buttonSecondary} onClick={() => setConfirming("clear")}>
                  Clear log
                </button>
              )}
              <button type="button" className={buttonSecondary} onClick={() => setConfirming("reset")}>
                Reset demo
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">Decisions, downloads and shares recorded for each RM</caption>
          <thead>
            <tr className="border-b border-line bg-raised text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-semibold">Timestamp (SGT)</th>
              <th className="px-4 py-2.5 font-semibold">RM</th>
              <th className="px-4 py-2.5 font-semibold">Decision type</th>
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Theme</th>
              <th className="px-4 py-2.5 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {log.map((entry) => (
              <tr key={entry.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 whitespace-nowrap text-muted tabular-nums">{fmtTimestampSgt(entry.timestamp)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-ink">{entry.rmName}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TYPE_STYLE[entry.type]}`}>{entry.type}</span>
                </td>
                <td className="px-4 py-2.5 text-ink">{entry.subject}</td>
                <td className="px-4 py-2.5 text-muted">{entry.theme}</td>
                <td className="px-4 py-2.5 text-muted">{entry.detail}</td>
              </tr>
            ))}
            {log.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  Nothing logged yet. Briefs, alerts, approvals, shares and review log entries appear here.{" "}
                  <Link to="/" className="font-medium text-brand-tint underline underline-offset-2">
                    Open the inbox
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Timestamps are the real time of each click, shown in Singapore time. The log is kept in this browser only.</p>
    </div>
  );
}
