import { useEffect, useMemo, useState, type ReactElement } from "react";
import { howAlertsWork } from "../config/alertRules";
import { Link, useParams } from "react-router-dom";
import { ReviewLogPanel } from "../components/ReviewLogPanel";
import { TalkingPointsWorkspace } from "../components/TalkingPointsWorkspace";
import { buttonPrimary, buttonSecondary, card, eyebrow, fieldInput, LockIcon, Tooltip } from "../components/ui";
import { data } from "../data";
import { fmtMove, fmtPct, fmtUsd } from "../logic/format";
import { simulateMonitor } from "../logic/monitor";
import { clientStatus, reviewEntryId, withApproval, withOutcome, withShare, type ClientStatus } from "../logic/reviewLog";
import { useApp } from "../state/AppContext";
import type { Alert, AlertTrigger, HoldingImpact, RankedClient } from "../types";

const STATUS_STYLE: Record<ClientStatus, string> = {
  "Not started": "border-line bg-raised text-muted",
  "In progress": "border-brand/60 bg-brand/25 text-brand-tint",
  "Talking points approved": "border-gain/50 bg-gain/12 text-gain",
  Shared: "border-gain bg-gain/20 text-gain",
  "No contact needed": "border-line bg-transparent text-soft",
};

export function StatusPill({ status }: { status: ClientStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>{status}</span>;
}

/** Finds the alert among those sent so far, or explains why it is not there yet. */
function useAlert(): { alert: Alert | null; missing: ReactElement | null } {
  const { alertId } = useParams();
  const { alerts, rm, date } = useApp();
  const alert = alerts.find((a) => a.id === alertId) ?? null;
  if (alert) return { alert, missing: null };
  const later = simulateMonitor({ date, rmId: rm.id, until: "23:59" }).alerts.find((a) => a.id === alertId);
  return {
    alert: null,
    missing: (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">{later ? "This alert hasn't arrived yet" : "Alert not found"}</h1>
        <p className="mt-3 text-muted">
          {later
            ? `It is sent at ${later.time} SGT, when the news behind it arrives.`
            : `There is no Client Alert ${alertId} for ${rm.name} today.`}
        </p>
        <Link to="/alerts" className={`${buttonPrimary} mt-6`}>
          Open alerts
        </Link>
      </div>
    ),
  };
}

const clientOf = (id: string) => data.clients.find((c) => c.id === id);

/** Portal overview (update 2, 5.1): one card per affected client, ordered by priority score. */
export function AlertOverview() {
  const { alert, missing } = useAlert();
  const { reviewLog } = useApp();
  if (!alert) return missing;
  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-8">
      <div>
        <Link to="/alerts" className="text-sm font-medium text-brand-tint hover:text-white">
          ← All alerts
        </Link>
        <p className="mt-4 text-[10px] font-semibold tracking-widest text-checkpoint uppercase">
          Client Alert · detected {alert.time} SGT · {alert.triggers.length} {alert.triggers.length === 1 ? "client" : "clients"}
        </p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight text-ink">Clients affected</h1>
        <p className="mt-2 text-sm text-muted">Talking points are drafted for each client. You decide what, if anything, to share. The agent never contacts clients.</p>
      </div>
      <ul className="space-y-3">
        {alert.triggers.map((trigger) => {
          const client = clientOf(trigger.clientId);
          if (!client) return null;
          const entry = reviewLog.find((e) => e.id === reviewEntryId(alert, client.id));
          return (
            <li key={client.id} className={`${card} flex flex-wrap items-center gap-x-6 gap-y-3 p-5`}>
              <div className="min-w-[14rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink">{client.name}</h2>
                  <StatusPill status={clientStatus(entry)} />
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  {client.mandate} · {client.riskProfile}
                </p>
                <p className="mt-3 text-sm text-soft">
                  <span className={`${eyebrow} mr-2`}>Why you're seeing this</span>
                  {trigger.reason}
                </p>
              </div>
              <Link to={`/alerts/${alert.id}/client/${client.id}`} className={buttonPrimary}>
                Open
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The holdings behind the trigger: the event's instrument, or the theme's affected holdings. */
function triggerHoldings(trigger: AlertTrigger, row: RankedClient | undefined): HoldingImpact[] {
  if (!row) return [];
  const all = [row.primary, ...row.others];
  const assessment = all.find((a) => a.theme.id === (trigger.themeId ?? trigger.positionEventId));
  if (assessment) return assessment.exposure.holdings;
  if (trigger.kind === "position-event") {
    const event = data.positionEvents.find((e) => e.id === trigger.positionEventId);
    const holding = data.holdings.find((h) => h.clientId === trigger.clientId && h.instrument === event?.instrument);
    const client = clientOf(trigger.clientId);
    const fromThemes = all.flatMap((a) => a.exposure.holdings).find((h) => h.holding.instrument === event?.instrument);
    if (fromThemes) return [fromThemes];
    if (holding && client) return [{ holding, tag: holding.tags[0], estMovePct: 0, estImpactUsd: 0, pctOfAum: holding.marketValueUsd / client.aumUsd }];
  }
  return row.primary.exposure.holdings;
}

function TriggerCard({ trigger, row }: { trigger: AlertTrigger; row: RankedClient | undefined }) {
  const client = clientOf(trigger.clientId);
  const holdings = triggerHoldings(trigger, row);
  const event = trigger.positionEventId ? data.positionEvents.find((e) => e.id === trigger.positionEventId) : undefined;
  return (
    <section className="rounded-lg border-2 border-checkpoint/70 bg-surface p-5" aria-label="Trigger">
      <p className="text-[10px] font-semibold tracking-widest text-checkpoint uppercase">Why you're seeing this</p>
      <h2 className="mt-1.5 text-lg font-semibold text-ink">{trigger.reason}</h2>
      {event && <p className="mt-1.5 text-sm leading-relaxed text-soft">{event.description}</p>}
      {holdings.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className={eyebrow}>Affected holdings</span>
            <Tooltip content="Figures come from portfolio data and can't be edited in chat.">
              <span className="inline-flex items-center gap-1 rounded border border-line bg-raised px-1.5 py-0.5 text-[10px] tracking-wide text-muted">
                <LockIcon className="h-3 w-3" />
                Locked
              </span>
            </Tooltip>
          </div>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-raised text-left text-xs text-muted">
                  <th className="px-3 py-2 font-semibold">Holding</th>
                  <th className="px-3 py-2 font-semibold">Bank</th>
                  <th className="px-3 py-2 text-right font-semibold">Value</th>
                  <th className="px-3 py-2 text-right font-semibold">% of AUM</th>
                  <th className="px-3 py-2 text-right font-semibold">Est. move</th>
                  <th className="px-3 py-2 text-right font-semibold">Est. impact</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.holding.instrument} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink">{h.holding.instrument}</td>
                    <td className="px-3 py-2 text-muted">{h.holding.bank}</td>
                    <td className="px-3 py-2 text-right text-soft tabular-nums">{fmtUsd(h.holding.marketValueUsd)}</td>
                    <td className="px-3 py-2 text-right text-soft tabular-nums">{fmtPct(h.pctOfAum)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${h.estMovePct < 0 ? "text-loss" : h.estMovePct > 0 ? "text-gain" : "text-muted"}`}>
                      {h.estMovePct === 0 ? "—" : fmtMove(h.estMovePct)}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${h.estImpactUsd < 0 ? "text-loss" : h.estImpactUsd > 0 ? "text-gain" : "text-muted"}`}>
                      {h.estImpactUsd === 0 ? "—" : fmtUsd(h.estImpactUsd, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {client?.notes && (
        <p className="mt-4 rounded-md border border-line bg-raised px-3 py-2 text-sm text-soft">
          <span className="font-semibold text-ink">Client note:</span> {client.notes}
        </p>
      )}
    </section>
  );
}

/** "No contact needed": an optional one-line reason, then status, log entry and activity log. Deletes nothing. */
function NoContactNeeded({ alert, clientId, done }: { alert: Alert; clientId: string; done: boolean }) {
  const { logForReview, addLog } = useApp();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const client = clientOf(clientId);
  if (!client) return null;
  if (done) return <span className="text-sm text-muted">Marked as no contact needed.</span>;
  const confirm = () => {
    const entryId = reviewEntryId(alert, clientId);
    // A deliberate decision, so it goes to the review straight away.
    logForReview(entryId, (e) => ({ ...withOutcome(e, "No contact needed"), ...(reason.trim() ? { rmNote: reason.trim() } : {}) }));
    addLog({ type: "No contact needed", subject: client.name, theme: alert.triggers.find((t) => t.clientId === clientId)?.reason ?? "", detail: reason.trim() || "No reason given" });
    setAsking(false);
  };
  if (!asking) {
    return (
      <button type="button" className={buttonSecondary} onClick={() => setAsking(true)}>
        No contact needed
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        autoFocus
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && confirm()}
        placeholder="Reason (optional), e.g. spoke to the client yesterday"
        aria-label="Reason for no contact (optional)"
        className={`${fieldInput} w-80 px-3 py-2 text-sm`}
      />
      <button type="button" className={buttonPrimary} onClick={confirm}>
        Confirm
      </button>
      <button type="button" className="text-sm text-muted hover:text-white" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </div>
  );
}

/** Client workspace (update 2, 5.2): trigger card, talking points for the RM, and the review log entry. */
export function ClientWorkspace() {
  const { alert, missing } = useAlert();
  const { clientId } = useParams();
  const { stateForAlert, openClientWorkspace, reviewLog, changeReviewEntry, rm, date } = useApp();
  const trigger = alert?.triggers.find((t) => t.clientId === clientId);
  const row = useMemo(() => (alert && clientId ? stateForAlert(alert).clients.find((r) => r.client.id === clientId) : undefined), [alert, clientId, stateForAlert]);
  const ctx = useMemo(() => ({ rm, date }), [rm, date]);

  // The log entry is created the first time the RM opens this workspace from the alert.
  useEffect(() => {
    if (alert && trigger) openClientWorkspace(alert, trigger, row);
  }, [alert, trigger, row, openClientWorkspace]);

  if (!alert) return missing;
  const client = clientId ? clientOf(clientId) : undefined;
  if (!trigger || !client) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Client not in this alert</h1>
        <Link to={`/alerts/${alert.id}`} className={`${buttonPrimary} mt-6`}>
          Back to the alert
        </Link>
      </div>
    );
  }
  const entryId = reviewEntryId(alert, client.id);
  const entry = reviewLog.find((e) => e.id === entryId);
  const now = () => new Date().toISOString();

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to={`/alerts/${alert.id}`} className="text-sm font-medium text-brand-tint hover:text-white">
            ← All clients in this alert
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-4xl tracking-tight text-ink">{client.name}</h1>
            <StatusPill status={clientStatus(entry)} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {client.mandate} · {client.riskProfile} · {client.banks.join(" · ")} · AUM {fmtUsd(client.aumUsd)}
          </p>
        </div>
        <NoContactNeeded alert={alert} clientId={client.id} done={entry?.outcome === "No contact needed"} />
      </div>

      <TriggerCard trigger={trigger} row={row} />

      <section>
        <h2 className="mb-1 font-serif text-2xl text-ink">Talking points for you</h2>
        <p className="mb-4 text-sm text-muted">For your conversation with the client. Sharing them is optional and only possible after approval.</p>
        {row ? (
          <TalkingPointsWorkspace
            row={row}
            ctx={ctx}
            scanKey={alert.id}
            onApproved={(version) => changeReviewEntry(entryId, (e) => withApproval(e, version))}
            onShared={(channel, version) => changeReviewEntry(entryId, (e) => withShare(e, channel, version, now()))}
          />
        ) : (
          <p className={`${card} p-5 text-sm text-muted`}>No market theme touches this client today, so there are no talking points to draft. The trigger above is the reason for the alert.</p>
        )}
      </section>

      {entry && <ReviewLogPanel entry={entry} />}
    </div>
  );
}

/** Monitor activity (update 3, 1.3): every item checked today, and what it led to. */
function MonitorActivity() {
  const { evaluations, alerts } = useApp();
  const last = evaluations.at(-1);
  const clientsOf = new Map(alerts.map((a) => [a.id, a.triggers.length]));
  return (
    <section className={`${card} p-5`} aria-label="Monitor activity">
      <p className={eyebrow}>Monitor activity today</p>
      <p className="mt-1.5 text-sm font-medium text-ink">
        Items checked today: {evaluations.length} · Alerts sent: {alerts.length}
        {last ? ` · Last item ${last.evaluatedAt.slice(11, 16)}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted">Every news item and holding event is checked as it arrives. An email goes out only when a client is materially affected.</p>
      <details className="mt-3 text-sm">
        <summary className="font-medium text-brand-tint select-none hover:text-white">Every item evaluated</summary>
        <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-bg">
          {[...evaluations].reverse().map((e) => (
            <li key={e.itemId} className="flex items-baseline gap-3 px-3 py-2">
              <span className="w-10 shrink-0 text-xs text-muted tabular-nums">{e.evaluatedAt.slice(11, 16)}</span>
              <span className="min-w-0 flex-1 text-soft">{e.headline}</span>
              {e.alertId ? (
                <Link to={`/alerts/${e.alertId}`} className="shrink-0 text-xs font-semibold text-checkpoint hover:underline">
                  Alert sent ({clientsOf.get(e.alertId)} {clientsOf.get(e.alertId) === 1 ? "client" : "clients"})
                </Link>
              ) : (
                <span className="shrink-0 text-xs text-muted">No alert needed</span>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/** "How alerts work": the alert rule in plain language, generated from src/config/alertRules.ts. */
function HowAlertsWork() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-sm font-medium text-brand-tint underline underline-offset-2 hover:text-white">
        How alerts work
      </button>
      {open && (
        <div role="dialog" aria-label="How alerts work" className="absolute left-0 z-20 mt-2 w-[26rem] max-w-[calc(100vw-3rem)] rounded-lg border border-line bg-raised p-4 text-sm leading-relaxed text-soft shadow-xl shadow-black/40">
          <p>{howAlertsWork()}</p>
          <button type="button" onClick={() => setOpen(false)} className="mt-3 text-xs font-medium text-brand-tint hover:text-white">
            Close
          </button>
        </div>
      )}
    </div>
  );
}

/** /alerts (update 3, 3.4): the home for client work. */
export function AlertsHome() {
  const { alerts, rm } = useApp();
  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-10">
      <div>
        <p className="text-sm text-muted">Monday, 12 October 2026 · {rm.name}</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight text-ink">Client Alerts</h1>
      </div>
      <MonitorActivity />
      <section>
        <h2 className="mb-3 font-serif text-2xl text-ink">Today's alerts</h2>
        {alerts.length === 0 ? (
          <p className={`${card} p-5 text-sm text-muted`}>No alerts today. Nothing in your clients' portfolios met the alert threshold.</p>
        ) : (
          <ul className="space-y-3">
            {[...alerts].reverse().map((alert) => {
              const names = alert.triggers.map((t) => clientOf(t.clientId)?.name).join(", ");
              return (
                <li key={alert.id}>
                  <Link to={`/alerts/${alert.id}`} className={`${card} flex flex-wrap items-center gap-x-6 gap-y-2 border-checkpoint/50 p-5 hover:border-checkpoint`}>
                    <span className="w-14 text-lg font-semibold text-checkpoint tabular-nums">{alert.time}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">
                        {alert.triggers.length} {alert.triggers.length === 1 ? "client" : "clients"} · {names}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{alert.triggers.map((t) => t.reason).join(" · ")}</span>
                    </span>
                    <span className="text-sm font-medium text-brand-tint">Open →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <HowAlertsWork />
    </div>
  );
}
