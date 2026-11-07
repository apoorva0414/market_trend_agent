import { useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useBrandLogo } from "../components/Brand";
import { AgentLabel, card, eyebrow, textLink } from "../components/ui";
import { buildAlertEmail, buildBriefEmail, type EmailModel, renderEmailBody } from "../email/template";
import { useApp } from "../state/AppContext";

interface InboxItem {
  id: string;
  model: EmailModel;
  href?: string;
  sortKey: string;
  exported: string;
}

/** Landing page: today's inbox. Two MarketPulse emails land here: the Daily Brief and Client Alerts. */
export function Inbox() {
  const { rm, brief, alerts, stateForAlert } = useApp();
  const navigate = useNavigate();
  const logoUrl = useBrandLogo();

  const items = useMemo<InboxItem[]>(() => {
    const briefItem: InboxItem = { id: "brief", model: buildBriefEmail(brief, rm), sortKey: "09:00", exported: `email-preview-${rm.id}.html` };
    const alertItems = alerts.map((alert) => ({
      id: alert.id,
      model: buildAlertEmail(alert, rm, stateForAlert(alert)),
      href: `#/alerts/${alert.id}`,
      sortKey: alert.time,
      exported: `alert-preview-${rm.id}-${alert.id}.html`,
    }));
    return [...alertItems, briefItem].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [alerts, brief, rm, stateForAlert]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const bodyHtml = useMemo(() => renderEmailBody(selected.model, { href: selected.href, logoUrl }), [selected, logoUrl]);

  // Only the Client Alert has a button (Open in portal). It is routed inside the app.
  const onBodyClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest("a[data-open-link]");
    if (!link || !selected.href) return;
    event.preventDefault();
    navigate(selected.href.slice(1));
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <p className="text-sm text-muted">Monday, 12 October 2026 · {rm.name}</p>
      <h1 className="mt-1 font-serif text-4xl tracking-tight text-ink">Inbox</h1>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div>
          <ul className={`${card} divide-y divide-line overflow-hidden`} aria-label="Today's emails">
            {items.map((item) => {
              const active = item.id === selected.id;
              const alert = item.model.kind === "alert";
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-current={active ? "true" : undefined}
                    className={`block w-full px-4 py-3.5 text-left transition-colors ${active ? "bg-raised" : "hover:bg-raised/60"} ${alert ? "shadow-[inset_3px_0_0_var(--color-checkpoint)]" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-xs font-semibold ${alert ? "text-checkpoint" : "text-brand-tint"}`}>{item.model.from}</span>
                      <span className="text-xs text-muted tabular-nums">{item.model.time.replace(" SGT", "")}</span>
                    </div>
                    <div className="mt-1 text-sm font-medium leading-snug text-ink">{item.model.subject}</div>
                  </button>
                </li>
              );
            })}
          </ul>
          {alerts.length === 0 && <p className="mt-3 px-1 text-sm leading-relaxed text-muted">No alerts today. Nothing in your clients' portfolios met the alert threshold.</p>}
          <p className="mt-4 px-1 text-xs leading-relaxed text-muted">
            The MarketPulse Daily Brief arrives every business day at 09:00 SGT. Client Alerts arrive whenever news materially affects a client, at any time of day.
          </p>
        </div>

        <article className={`${card} overflow-hidden ${selected.model.kind === "alert" ? "border-checkpoint/60" : ""}`}>
          <div className="border-b border-line bg-raised px-8 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">{selected.model.subject}</h2>
              <AgentLabel />
            </div>
            <dl className="mt-3 grid grid-cols-[4rem_1fr] gap-y-1 text-sm">
              <dt className="text-muted">From</dt>
              <dd className="text-ink">{selected.model.from}</dd>
              <dt className="text-muted">To</dt>
              <dd className="text-ink">{selected.model.to}</dd>
              <dt className="text-muted">Sent</dt>
              <dd className="text-ink">
                {selected.model.dateLong}, {selected.model.time}
              </dd>
            </dl>
          </div>
          <div className="px-8 py-8" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          <div className="flex items-center justify-between gap-3 border-t border-line px-8 py-3 text-xs text-muted">
            <span className={eyebrow}>{selected.model.kind === "brief" ? "Read only · nothing to open or act on" : "Client Alert"}</span>
            {/* Standalone builds (such as the Claude artifact) do not ship the exported HTML files. */}
            {import.meta.env.VITE_STANDALONE !== "true" && (
              <a href={`${import.meta.env.BASE_URL}${selected.exported}`} target="_blank" rel="noreferrer" className={textLink}>
                Open the exported email (HTML)
              </a>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
