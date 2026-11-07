import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { buttonSecondary, card, eyebrow } from "../components/ui";
import { data } from "../data";
import { fmtDateMedium, fmtTimeSgt, joinList, plural } from "../logic/format";
import { lastReviewDate, periodEntries, timeUntil } from "../logic/reviewLog";
import { useApp } from "../state/AppContext";
import type { Client, ReviewLogEntry } from "../types";

// "Upcoming reviews": the RM's scheduled portfolio reviews, with what happened to each client since
// the last one. Client list on the left, the selected client's review prep on the right.

type IconName = "alert" | "shared" | "approved" | "drafted" | "contact" | "flag";

const ICON_PATHS: Record<IconName, ReactNode> = {
  alert: <path d="M8 2.5a3.5 3.5 0 0 0-3.5 3.5v2.5L3 10.5h10l-1.5-2V6A3.5 3.5 0 0 0 8 2.5zM6.5 12.5a1.5 1.5 0 0 0 3 0" />,
  shared: <path d="M2.5 8l11-5-4 11-2-4.5z" />,
  approved: <path d="M3 8.5l3 3 7-7" />,
  drafted: <path d="M3 13h3l7-7-3-3-7 7zM9 4l3 3" />,
  contact: <path d="M4 2.5h2l1 3-1.5 1a7 7 0 0 0 3 3l1-1.5 3 1v2a1.5 1.5 0 0 1-1.5 1.5A10 10 0 0 1 2.5 4 1.5 1.5 0 0 1 4 2.5z" />,
  flag: <path d="M4 14V2.5M4 3h7l-1.5 3L11 9H4" />,
};

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

function Step({ icon, tone = "text-soft", children }: { icon: IconName; tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-0.5 text-xs ${tone}`}>
      <Icon name={icon} />
      {children}
    </span>
  );
}

/** One timeline entry in plain language: what happened, then each step the RM took. */
function TimelineEntry({ entry }: { entry: ReviewLogEntry }) {
  const tp = entry.talkingPoints;
  return (
    <li className="relative pl-7">
      <span className="absolute top-0.5 left-0 flex h-5 w-5 items-center justify-center rounded-full border border-checkpoint/60 bg-bg text-checkpoint">
        <Icon name="alert" className="h-3 w-3" />
      </span>
      <p className="text-xs font-semibold text-muted tabular-nums">{fmtDateMedium(entry.createdAt.slice(0, 10))}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{entry.trigger.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tp.status === "shared" ? (
          <Step icon="shared" tone="text-gain">
            Talking points shared by {joinList(tp.sharedVia ?? [])}
            {tp.sharedAt ? ` at ${fmtTimeSgt(tp.sharedAt)}` : ""}
          </Step>
        ) : tp.status === "approved" ? (
          <Step icon="approved" tone="text-gain">
            Talking points approved
          </Step>
        ) : (
          <Step icon="drafted" tone="text-muted">
            Talking points not approved
          </Step>
        )}
        {entry.outcome && <Step icon="contact">{entry.outcome}</Step>}
        {entry.discussAtNextReview && (
          <Step icon="flag" tone="text-checkpoint">
            To discuss
          </Step>
        )}
      </div>
      {entry.rmNote && <p className="mt-2 border-l-2 border-line pl-3 text-sm text-soft italic">"{entry.rmNote}"</p>}
    </li>
  );
}

function ClientReview({ client, entries }: { client: Client; entries: ReviewLogEntry[] }) {
  const { date } = useApp();
  const [copied, setCopied] = useState(false);
  const toDiscuss = entries.filter((e) => e.discussAtNextReview);
  const json = JSON.stringify(entries, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The payload stays visible below and can be selected by hand.
    }
  };

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h2 className="font-serif text-3xl text-ink">{client.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {client.mandate} · {client.riskProfile} · next review <span className="text-ink">{fmtDateMedium(client.nextReviewDate)}</span> ({timeUntil(client.nextReviewDate, date)}) · last review{" "}
          {fmtDateMedium(lastReviewDate(client.nextReviewDate))}
        </p>
      </div>

      <section className="rounded-lg border-2 border-checkpoint/70 bg-surface p-5">
        <h3 className="flex items-center gap-2 font-serif text-xl text-ink">
          <Icon name="flag" className="h-4 w-4 text-checkpoint" />
          To discuss at the review
        </h3>
        {toDiscuss.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing flagged for this review.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-soft">
            {toDiscuss.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-24 shrink-0 text-muted tabular-nums">{fmtDateMedium(e.createdAt.slice(0, 10))}</span>
                <span>{e.rmNote || e.trigger.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} p-5`}>
        <h3 className="font-serif text-xl text-ink">This period</h3>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing logged since the last review.</p>
        ) : (
          <ol className="mt-4 space-y-5">
            {entries.map((e) => (
              <TimelineEntry key={e.id} entry={e} />
            ))}
          </ol>
        )}
      </section>

      <details className={card}>
        <summary className="px-5 py-3.5 text-sm font-semibold text-ink select-none">What the Portfolio Review agent receives (JSON)</summary>
        <div className="border-t border-line p-5">
          <p className="text-sm text-muted">In the next phase, this feeds the "Headlines" section of the Portfolio Review Studio.</p>
          <button type="button" className={`${buttonSecondary} mt-3`} onClick={copy}>
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <pre className="mt-3 max-h-[28rem] overflow-auto rounded-md border border-line bg-bg p-4 text-xs leading-relaxed text-soft">{json}</pre>
        </div>
      </details>
    </div>
  );
}

/** /reviews and /reviews/:clientId */
export function UpcomingReviews() {
  const { clientId } = useParams();
  const { reviewLog, rm, date } = useApp();
  const clients = data.clients.filter((c) => c.rmId === rm.id).sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
  const entriesFor = (client: Client) => periodEntries(reviewLog, client.id, client.nextReviewDate);
  const selected = clients.find((c) => c.id === clientId) ?? clients.find((c) => entriesFor(c).length > 0) ?? clients[0];

  return (
    <div className="mx-auto max-w-[1300px] px-6 py-10">
      <h1 className="font-serif text-4xl tracking-tight text-ink">Upcoming reviews</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Your clients' scheduled portfolio reviews, soonest first, with everything you logged since the last one. The Portfolio Review agent starts from this.
      </p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <ul className={`${card} divide-y divide-line overflow-hidden`} aria-label="Clients by next review">
          {clients.map((client) => {
            const entries = entriesFor(client);
            const flagged = entries.filter((e) => e.discussAtNextReview).length;
            const last = entries.at(-1);
            const active = client.id === selected?.id;
            return (
              <li key={client.id}>
                <Link
                  to={`/reviews/${client.id}`}
                  aria-current={active ? "true" : undefined}
                  className={`block px-4 py-3 transition-colors ${active ? "bg-raised" : "hover:bg-raised/60"}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-ink">{client.name}</span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">{timeUntil(client.nextReviewDate, date)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">Review {fmtDateMedium(client.nextReviewDate)}</div>
                  {entries.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="text-soft">{plural(entries.length, "event")}</span>
                      {flagged > 0 && (
                        <span className="inline-flex items-center gap-1 text-checkpoint">
                          <Icon name="flag" className="h-3 w-3" />
                          {flagged} to discuss
                        </span>
                      )}
                      {last?.outcome && <span className="text-muted">Last: {last.outcome}</span>}
                    </div>
                  ) : (
                    <div className="mt-1.5 text-xs text-muted/80">Nothing logged this period</div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <ClientReview client={selected} entries={entriesFor(selected)} />
        ) : (
          <p className={`${card} p-6 text-sm text-muted`}>No clients.</p>
        )}
      </div>
      <p className={`${eyebrow} mt-6`}>Entries appear here when you click "Log for next portfolio review" on a client alert.</p>
    </div>
  );
}
