import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmtDateMedium, fmtTimeSgt, joinList } from "../logic/format";
import { isLogged, OUTCOMES } from "../logic/reviewLog";
import { useApp } from "../state/AppContext";
import type { ReviewLogEntry } from "../types";
import { buttonPrimary, card, eyebrow, fieldInput, textLink } from "./ui";

export const REVIEW_LOG_PURPOSE =
  "This is saved for the client's next scheduled portfolio review, so you won't need to piece the period together from emails and chats, and any concerns the client raised will be followed up.";

export function talkingPointsSummary(entry: ReviewLogEntry): string {
  const tp = entry.talkingPoints;
  if (tp.status === "shared") return `v${tp.approvedVersion} shared via ${joinList(tp.sharedVia ?? [])}${tp.sharedAt ? ` at ${fmtTimeSgt(tp.sharedAt)}` : ""}`;
  if (tp.status === "approved") return `v${tp.approvedVersion} approved, not shared`;
  return "Drafted, not yet approved";
}

/**
 * "Log for next portfolio review". The RM records what happened (all optional) and logs it with one click.
 * Approvals and shares keep the entry up to date before and after logging.
 */
type Draft = Pick<ReviewLogEntry, "outcome" | "rmNote" | "discussAtNextReview">;
const draftOf = (e: ReviewLogEntry): Draft => ({ outcome: e.outcome, rmNote: e.rmNote ?? "", discussAtNextReview: e.discussAtNextReview });
const sameDraft = (a: Draft, b: Draft) => a.outcome === b.outcome && (a.rmNote ?? "") === (b.rmNote ?? "") && a.discussAtNextReview === b.discussAtNextReview;

export function ReviewLogPanel({ entry }: { entry: ReviewLogEntry }) {
  const { logForReview } = useApp();
  const logged = isLogged(entry);
  const saved = draftOf(entry);
  // Outcome, note and the discuss flag are edited here and saved only with the button.
  const [draft, setDraft] = useState<Draft>(saved);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  // If the saved entry changes elsewhere (No contact needed), start again from it.
  useEffect(() => setDraft(draftOf(entry)), [entry.id, entry.outcome, entry.rmNote, entry.discussAtNextReview]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !sameDraft(draft, saved);
  const save = () => {
    const note = (draft.rmNote ?? "").trim();
    logForReview(entry.id, (e) => {
      const next: ReviewLogEntry = { ...e, outcome: draft.outcome, rmNote: note || undefined, discussAtNextReview: draft.discussAtNextReview };
      if (!next.outcome) delete next.outcome;
      if (!next.rmNote) delete next.rmNote;
      return next;
    });
    if (logged) setUpdatedAt(new Date().toISOString());
  };
  const noteId = `review-note-${entry.id}`;
  const discussId = `review-discuss-${entry.id}`;
  const review = fmtDateMedium(entry.nextReviewDate);

  return (
    <section className={`${card} p-5 ${logged ? "" : "border-checkpoint/60"}`} aria-label="Log for next portfolio review">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-ink">Log for next portfolio review</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{REVIEW_LOG_PURPOSE}</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-ink">Next scheduled review: {review}</div>
        </div>
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted">What happened</dt>
        <dd className="text-ink">{entry.trigger.summary}</dd>
        <dt className="text-muted">Talking points</dt>
        <dd className="text-ink">{talkingPointsSummary(entry)}</dd>
        <dt className="text-muted">Holdings</dt>
        <dd className="text-soft">{entry.holdingsSnapshot.map((h) => h.instrument).join(" · ") || "None"}</dd>
      </dl>

      <div className="mt-5">
        <p className={eyebrow}>Outcome (optional)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {OUTCOMES.map((outcome) => {
            const active = draft.outcome === outcome;
            const setByButton = outcome === "No contact needed";
            return (
              <button
                key={outcome}
                type="button"
                aria-pressed={active}
                disabled={setByButton && !active}
                title={setByButton ? "Set with the No contact needed button" : undefined}
                onClick={() => setDraft((d) => ({ ...d, outcome: active ? undefined : outcome, discussAtNextReview: !active && outcome === "Contacted: concerns raised" ? true : d.discussAtNextReview }))}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  active ? "border-brand bg-brand text-white" : "border-line bg-raised text-soft hover:border-brand-tint hover:text-strong"
                }`}
              >
                {outcome}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label htmlFor={noteId} className="block">
          <span className={eyebrow}>Note</span>
          <input
            id={noteId}
            type="text"
            value={draft.rmNote ?? ""}
            onChange={(event) => setDraft((d) => ({ ...d, rmNote: event.target.value }))}
            placeholder="Client's reaction or anything to follow up (optional)"
            className={`${fieldInput} mt-1.5 w-full px-3 py-2 text-sm`}
          />
        </label>
        <label htmlFor={discussId} className="flex items-center gap-2.5 pb-2 text-sm font-medium text-ink">
          <input
            id={discussId}
            type="checkbox"
            checked={draft.discussAtNextReview}
            onChange={(event) => setDraft((d) => ({ ...d, discussAtNextReview: event.target.checked }))}
            className="h-4 w-4 accent-brand-tint"
          />
          Discuss at next review
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {logged ? (
          <>
            <button type="button" className={buttonPrimary} disabled={!dirty} onClick={save}>
              Update log
            </button>
            {dirty ? (
              <span className="text-sm text-checkpoint" role="status">
                Unsaved changes. Click Update log to save them to the review.
              </span>
            ) : (
              <span className="text-sm text-gain" role="status">
                Logged for the {review} review at {fmtTimeSgt(entry.loggedAt!)} SGT{updatedAt ? `, updated at ${fmtTimeSgt(updatedAt)} SGT` : ""}.
              </span>
            )}
            <Link to={`/reviews/${entry.clientId}`} className={`${textLink} text-sm`}>
              View in Upcoming reviews
            </Link>
            <span className="w-full text-xs text-muted">Approvals and shares of the talking points are added to the log automatically.</span>
          </>
        ) : (
          <>
            <button type="button" className={buttonPrimary} onClick={save}>
              Log for next portfolio review
            </button>
            <span className="text-sm text-muted">Adds this to the {review} review. Nothing above is required.</span>
          </>
        )}
      </div>
    </section>
  );
}
