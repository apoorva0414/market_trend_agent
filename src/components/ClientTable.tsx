import { Fragment, useState } from "react";
import { fmtDateMedium, fmtMove, fmtPct, fmtScore, fmtUsd } from "../logic/format";
import { useApp } from "../state/AppContext";
import type { ClientAction, RankedClient, ThemeAssessment } from "../types";
import { NewBadge, PriorityPill, Tooltip, TypeBadge } from "./ui";

const ACTIONS: ClientAction[] = ["Talking points", "Portfolio review", "Skip"];

/** The row shows the first sentence of a client note; the expanded row shows all of it. */
function firstSentence(text: string): string {
  const end = text.indexOf(". ");
  return end === -1 ? text : text.slice(0, end + 1);
}

function impactColour(value: number): string {
  return value < 0 ? "text-loss" : "text-gain";
}

function WhyThisRank({ row }: { row: RankedClient }) {
  const { factors, exposure, theme } = row.primary;
  const { client } = row;
  const lines: [string, string, string][] = [
    ["Estimated impact", fmtPct(exposure.estImpactPct, 2, true) + " of AUM", fmtScore(factors.base)],
    [`Risk profile: ${client.riskProfile}`, "", `× ${factors.riskWeight}`],
    [`Mandate: ${client.mandate}`, "", `× ${factors.mandateWeight}`],
    [exposure.estImpactUsd < 0 ? "Estimated loss" : "No estimated loss", "", `× ${factors.lossWeight}`],
    [factors.contactReason ? `Contact: ${factors.contactReason}` : "Contact: recent, no boost", "", `× ${factors.contactBoost}`],
  ];
  return (
    <Tooltip
      content={
        <div>
          <p className="mb-1.5 font-semibold text-white">Why this rank</p>
          <p className="mb-2 text-soft">Scored on the primary theme: {theme.title}</p>
          <table className="w-full">
            <tbody>
              {lines.map(([label, note, value]) => (
                <tr key={label}>
                  <td className="py-0.5 pr-2">
                    {label}
                    {note && <span className="text-muted"> ({note})</span>}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">{value}</td>
                </tr>
              ))}
              <tr className="border-t border-line font-semibold text-white">
                <td className="pt-1.5">Priority score</td>
                <td className="pt-1.5 text-right tabular-nums">{fmtScore(factors.score)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      }
    >
      <span className="text-[11px] whitespace-nowrap text-brand-tint underline decoration-dotted underline-offset-2">Why this rank</span>
    </Tooltip>
  );
}

function RankChange({ row }: { row: RankedClient }) {
  const change = row.change;
  if (!change) return null;
  if (change.isNew) return <span className="rounded bg-brand/25 px-1.5 py-0.5 text-[11px] font-semibold text-brand-tint">new</span>;
  if (change.rankDelta === 0) return null;
  const up = change.rankDelta > 0;
  return (
    <span className={`text-xs font-semibold tabular-nums ${up ? "text-brand-tint" : "text-muted"}`} title={`Moved ${up ? "up" : "down"} ${Math.abs(change.rankDelta)} since the 9 AM brief`}>
      {up ? "↑" : "↓"}
      {Math.abs(change.rankDelta)}
    </span>
  );
}

function HoldingsDetail({ assessment, primary }: { assessment: ThemeAssessment; primary: boolean }) {
  const { theme, exposure } = assessment;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">{theme.title}</span>
        <TypeBadge type={theme.type} />
        {theme.status !== "unchanged" && <NewBadge />}
        <span className="text-xs text-muted">
          {primary ? "Primary theme" : "Also affected"} · exposure {fmtUsd(exposure.exposureUsd)} ({fmtPct(exposure.exposurePct)}) · estimated impact{" "}
          <span className={`font-semibold ${impactColour(exposure.estImpactUsd)}`}>{fmtUsd(exposure.estImpactUsd, true)}</span>
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-raised text-left text-xs text-muted">
              <th className="px-3 py-1.5 font-semibold">Holding</th>
              <th className="px-3 py-1.5 font-semibold">Asset class</th>
              <th className="px-3 py-1.5 font-semibold">Bank</th>
              <th className="px-3 py-1.5 text-right font-semibold">Value</th>
              <th className="px-3 py-1.5 text-right font-semibold">% of AUM</th>
              <th className="px-3 py-1.5 text-right font-semibold">Est. move</th>
              <th className="px-3 py-1.5 text-right font-semibold">Est. impact</th>
              <th className="px-3 py-1.5 text-right font-semibold">Cost basis</th>
            </tr>
          </thead>
          <tbody>
            {exposure.holdings.map((h) => (
              <tr key={h.holding.instrument} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5 text-ink">
                  {h.holding.instrument}
                  {h.holding.barrierDistancePct !== undefined && (
                    <span className="ml-2 rounded border border-loss/50 bg-bg px-1.5 py-0.5 text-[11px] font-semibold text-loss">
                      {h.holding.barrierDistancePct}% above barrier
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-muted">{h.holding.assetClass}</td>
                <td className="px-3 py-1.5 text-muted">{h.holding.bank}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtUsd(h.holding.marketValueUsd)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtPct(h.pctOfAum)}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${impactColour(h.estMovePct)}`}>{fmtMove(h.estMovePct)}</td>
                <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${impactColour(h.estImpactUsd)}`}>{fmtUsd(h.estImpactUsd, true)}</td>
                <td className="px-3 py-1.5 text-right text-muted tabular-nums">{fmtUsd(h.holding.costBasisUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = "px-2.5 py-2.5 font-semibold whitespace-nowrap first:pl-4 last:pr-4";
const td = "px-2.5 py-3 align-top first:pl-4 last:pr-4";

/** Ranked list of affected clients with the per-client action select (spec 7.3). */
export function ClientTable() {
  const { scan, actionFor, setClientAction } = useApp();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (clientId: string) => setExpanded((state) => ({ ...state, [clientId]: !state[clientId] }));

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[1180px] text-sm">
        <thead>
          <tr className="border-b border-line bg-raised text-left text-xs text-muted">
            <th className={th}>Rank</th>
            <th className={th}>Client</th>
            <th className={th}>Mandate</th>
            <th className={th}>Risk</th>
            <th className={th}>Primary theme</th>
            <th className={`${th} text-right`}>Exposure</th>
            <th className={`${th} text-right`}>Est. impact</th>
            <th className={th}>Priority</th>
            <th className={th}>Recommended next step</th>
            <th className={th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {scan.clients.map((row) => {
            const { client, primary, others } = row;
            const { exposure, nextStep, theme } = primary;
            const open = !!expanded[client.id];
            const action = actionFor(row);
            return (
              <Fragment key={client.id}>
                <tr
                  onClick={() => toggle(client.id)}
                  className={`cursor-pointer border-b border-line transition-colors hover:bg-raised/70 ${open ? "bg-raised/70" : ""} ${row.change ? "shadow-[inset_3px_0_0_var(--color-brand-hover)]" : ""}`}
                >
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-xl text-ink tabular-nums">{row.rank}</span>
                      <RankChange row={row} />
                    </div>
                    <span onClick={(event) => event.stopPropagation()}>
                      <WhyThisRank row={row} />
                    </span>
                  </td>
                  <td className={`${td} min-w-[13.5rem]`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle(client.id);
                        }}
                        className="flex items-center gap-1.5 text-left font-semibold text-ink hover:text-white"
                      >
                        <svg viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true">
                          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {client.name}
                      </button>
                      {row.change && <NewBadge />}
                    </div>
                    <div className="mt-0.5 pl-[18px] text-xs text-muted">
                      {client.banks.join(" · ")} · AUM {fmtUsd(client.aumUsd)}
                    </div>
                    {client.notes && <div className="mt-1 pl-[18px] text-xs leading-snug text-muted italic">Note: {firstSentence(client.notes)}</div>}
                  </td>
                  <td className={`${td} text-soft`}>{client.mandate}</td>
                  <td className={`${td} text-soft`}>{client.riskProfile}</td>
                  <td className={td}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium whitespace-nowrap text-ink">{theme.shortTitle}</span>
                      <TypeBadge type={theme.type} />
                    </div>
                    {others.length > 0 && <div className="mt-0.5 max-w-[13rem] text-xs text-muted">Also: {others.map((o) => o.theme.shortTitle).join(", ")}</div>}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    <div className="font-medium whitespace-nowrap text-ink">{fmtUsd(exposure.exposureUsd)}</div>
                    <div className="text-xs text-muted">{fmtPct(exposure.exposurePct)}</div>
                  </td>
                  <td className={`${td} text-right tabular-nums ${impactColour(exposure.estImpactUsd)}`}>
                    <div className="font-semibold whitespace-nowrap">{fmtUsd(exposure.estImpactUsd, true)}</div>
                    <div className="text-xs">{fmtPct(exposure.estImpactPct, 2, true)}</div>
                  </td>
                  <td className={td}>
                    <PriorityPill priority={row.priority} />
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium whitespace-nowrap text-ink">{nextStep.action}</span>
                      {nextStep.flag && (
                        <span className="rounded border border-loss/50 bg-bg px-1.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-loss uppercase">{nextStep.flag}</span>
                      )}
                    </div>
                    <div className="mt-0.5 max-w-[13rem] text-xs text-muted">{nextStep.reason}</div>
                  </td>
                  <td className={td} onClick={(event) => event.stopPropagation()}>
                    <select
                      aria-label={`Action for ${client.name}`}
                      value={action}
                      onChange={(event) => setClientAction(client.id, event.target.value as ClientAction)}
                      className={`w-[9.75rem] rounded-md border-2 bg-surface px-2 py-1.5 text-sm font-medium focus:outline-none ${
                        action === "Skip" ? "border-line text-muted" : "border-checkpoint text-ink"
                      }`}
                    >
                      {ACTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-line bg-raised/60">
                    <td colSpan={10} className="px-6 py-5">
                      <div className="space-y-5">
                        <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs text-muted">
                          <span>
                            Last contact: <span className="font-medium text-ink">{fmtDateMedium(client.lastContactDate)}</span>
                          </span>
                          <span>
                            Prefers frequent updates: <span className="font-medium text-ink">{client.prefersFrequentUpdates ? "Yes" : "No"}</span>
                          </span>
                          <span>
                            Banks: <span className="font-medium text-ink">{client.banks.join(", ")}</span>
                          </span>
                        </div>
                        {client.notes && (
                          <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-soft">
                            <span className="font-semibold">Client note:</span> {client.notes}
                          </p>
                        )}
                        <HoldingsDetail assessment={primary} primary />
                        {others.map((other) => (
                          <HoldingsDetail key={other.theme.id} assessment={other} primary={false} />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
