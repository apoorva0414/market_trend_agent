import { Link } from "react-router-dom";
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
  const { log } = useApp();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl text-ink">Activity log</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            This log can also serve as evidence that discretionary clients were kept informed (to confirm with Compliance).
          </p>
        </div>
      </div>

      {/* Phones: one card per entry. */}
      <ul className="mt-6 space-y-3 md:hidden" aria-label="Activity log">
        {log.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-line bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TYPE_STYLE[entry.type]}`}>{entry.type}</span>
              <span className="text-xs text-muted tabular-nums">{fmtTimestampSgt(entry.timestamp)}</span>
            </div>
            <p className="mt-2 font-medium text-ink">{entry.subject}</p>
            {entry.theme && <p className="mt-0.5 text-muted">{entry.theme}</p>}
            {entry.detail && <p className="mt-0.5 text-muted">{entry.detail}</p>}
            <p className="mt-1.5 text-xs text-muted">{entry.rmName}</p>
          </li>
        ))}
        {log.length === 0 && (
          <li className="rounded-lg border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
            Nothing logged yet.{" "}
            <Link to="/" className="font-medium text-brand-tint underline underline-offset-2">
              Open the inbox
            </Link>
          </li>
        )}
      </ul>

      <div className="mt-6 hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
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
      <p className="mt-3 text-xs text-muted">Timestamps are the real time of each click, shown in Singapore time. The log is kept in this browser tab only and starts again with Reset demo.</p>
    </div>
  );
}
