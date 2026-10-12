import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DocumentView } from "../components/DocumentView";
import { TalkingPointsWorkspace } from "../components/TalkingPointsWorkspace";
import { buttonPrimary, buttonSecondary, card, DecisionLabel, decisionOutline, fieldInput, SectionHeading, textLink, TypeBadge } from "../components/ui";
import { buildPortfolioReviewHandoff, buildProposalHandoff, NO_PROFILE, type BuildContext } from "../documents/builders";
import { portfolioReviewToDoc, proposalToDoc } from "../documents/model";
import { checkPortfolioReview, checkProposal, CONTEXT_CHIPS, type Gap, gapSummary, READY_MESSAGE } from "../logic/completeness";
import { fmtTimestampSgt, plural } from "../logic/format";
import { runScan } from "../logic/scan";
import { useApp } from "../state/AppContext";
import type { ActiveTheme, DocModel, Handoff, LogType, ProspectTheme, RankedClient } from "../types";

function useDownload(model: DocModel, log: () => void) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      // The docx library is large, so it is loaded only when a download is requested.
      const { downloadDocx } = await import("../documents/docx");
      await downloadDocx(model);
      log();
    } finally {
      setBusy(false);
    }
  };
  return { busy, download };
}

function Panel({ title, subtitle, theme, document, children }: { title: string; subtitle: string; theme: ActiveTheme; document: DocModel; children: ReactNode }) {
  return (
    <section className={`${card} p-5`}>
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <span className="text-sm text-muted">{subtitle}</span>
        <TypeBadge type={theme.type} />
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <DocumentView model={document} />
        <aside className="space-y-4 lg:sticky lg:top-28">{children}</aside>
      </div>
    </section>
  );
}

function ViewNote({ theme }: { theme: ActiveTheme }) {
  if (theme.type !== "View") return null;
  return (
    <div className="rounded-md border border-checkpoint/60 bg-checkpoint/10 px-3.5 py-3 text-sm leading-relaxed text-checkpoint">
      <p className="font-semibold">This contains an opinion. Stress-test it before sharing.</p>
      {theme.stressTest && <p className="mt-1">{theme.stressTest}</p>}
    </div>
  );
}

/**
 * "Add context for the next agent" (update spec 2.1) with the one-pass completeness check (2.2).
 * No chat here: the Portfolio Review and Proposal agents have their own.
 */
function ContextBox({ id, kind, gaps }: { id: string; kind: Handoff["kind"]; gaps: Gap[] }) {
  const { notes, setNote } = useApp();
  const [checked, setChecked] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);
  const value = notes[id] ?? "";
  const fieldId = `context-${id}`;

  // After a chip or an "Add" link changes the text, jump to the box with the caret at the end.
  useEffect(() => {
    if (focusRequest === 0 || !box.current) return;
    box.current.focus();
    box.current.setSelectionRange(box.current.value.length, box.current.value.length);
    box.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusRequest]);

  const insert = (starter: string) => {
    if (starter && !value.includes(starter.trim())) {
      setNote(id, value.trim() === "" ? starter : `${value.replace(/\s+$/, "")}\n${starter}`);
    }
    setFocusRequest((count) => count + 1);
  };

  return (
    <div className={`rounded-lg bg-surface p-3.5 ${decisionOutline}`}>
      <label htmlFor={fieldId}>
        <DecisionLabel>Add context for the next agent</DecisionLabel>
      </label>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {CONTEXT_CHIPS[kind].map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => insert(chip.starter)}
            className="rounded-full border border-line bg-raised px-2.5 py-1 text-xs font-medium text-soft transition-colors hover:border-brand-tint hover:text-white"
          >
            {chip.label}
          </button>
        ))}
      </div>
      <textarea
        id={fieldId}
        ref={box}
        value={value}
        onChange={(event) => setNote(id, event.target.value)}
        rows={5}
        placeholder={
          kind === "portfolio-review"
            ? "What should the Portfolio Review agent know about this client?"
            : "What should the Proposal agent know about this prospect?"
        }
        className={`${fieldInput} mt-2.5 w-full p-2.5 text-sm leading-relaxed`}
      />

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <button type="button" className={`${buttonSecondary} px-3 py-1.5`} onClick={() => setChecked(true)}>
          Check completeness
        </button>
        {checked && <span className="text-xs text-muted">Rule-based check, no AI</span>}
      </div>

      {checked && (
        <div className="mt-3" role="status" aria-live="polite">
          {gaps.length === 0 ? (
            <p className="rounded-md border border-gain/40 bg-gain/12 px-3 py-2 text-sm font-medium text-gain">{READY_MESSAGE}</p>
          ) : (
            <>
              <p className="text-xs font-semibold text-checkpoint">{plural(gaps.length, "open gap")}. You can still send.</p>
              <ul className="mt-1.5 space-y-1.5">
                {gaps.map((gap) => (
                  <li key={gap.id} className="flex items-start justify-between gap-3 rounded-md border border-line bg-raised px-3 py-2 text-sm text-soft">
                    <span>{gap.message}</span>
                    <button type="button" className={`${textLink} shrink-0`} onClick={() => insert(gap.starter)}>
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SentNote({ id, path }: { id: string; path: string }) {
  const { handoffs } = useApp();
  const sent = handoffs[id];
  if (!sent) return null;
  return (
    <p className="text-xs leading-relaxed text-gain">
      Sent {fmtTimestampSgt(sent.createdAt)} SGT, {gapSummary(sent.openGaps.map((message, index) => ({ id: String(index), message, starter: "" })))}.{" "}
      <Link to={path} className="font-medium underline underline-offset-2">
        View hand-off
      </Link>
    </p>
  );
}

function PortfolioReviewPanel({ row, ctx }: { row: RankedClient; ctx: BuildContext }) {
  const { notes, saveHandoff, addLog } = useApp();
  const navigate = useNavigate();
  const { client } = row;
  const theme = row.primary.theme;
  const preview = useMemo(() => buildPortfolioReviewHandoff(row, ctx, "", [], ""), [row, ctx]);
  const id = preview.handoffId;
  const rmContext = notes[id] ?? "";
  const gaps = useMemo(() => checkPortfolioReview(client, rmContext, ctx.date), [client, rmContext, ctx.date]);
  const model = useMemo(() => portfolioReviewToDoc({ ...preview, rmContext: rmContext.trim() }), [preview, rmContext]);
  const log = (type: LogType, detail: string) => addLog({ type, subject: client.name, theme: theme.title, detail });
  const { busy, download } = useDownload(model, () => log("Downloaded", "Portfolio Review hand-off (.docx)"));

  // Send stays enabled with gaps open: the RM decides. The log records how many were left.
  const send = () => {
    saveHandoff(buildPortfolioReviewHandoff(row, ctx, rmContext, gaps.map((gap) => gap.message)));
    log("Portfolio review", `Hand-off ${id} to Portfolio Review, ${gapSummary(gaps)}`);
    navigate(`/portfolio-review/${id}`);
  };

  return (
    <Panel title={client.name} subtitle={`${client.mandate} · ${client.riskProfile} · ${theme.title}`} theme={theme} document={model}>
      <ViewNote theme={theme} />
      <ContextBox id={id} kind="portfolio-review" gaps={gaps} />
      <div className="grid gap-2">
        <button type="button" className={buttonPrimary} onClick={send}>
          Send to Portfolio Review
        </button>
        <button type="button" className={buttonSecondary} disabled={busy} onClick={download}>
          {busy ? "Preparing…" : "Download .docx"}
        </button>
      </div>
      <SentNote id={id} path={`/portfolio-review/${id}`} />
      <p className="text-xs leading-relaxed text-muted">Internal document. It goes to the Portfolio Review agent, not to the client.</p>
    </Panel>
  );
}

function ProposalPanel({ prospect, profile, ctx }: { prospect: ProspectTheme; profile: string; ctx: BuildContext }) {
  const { notes, saveHandoff, addLog } = useApp();
  const navigate = useNavigate();
  const { theme } = prospect;
  const preview = useMemo(() => buildProposalHandoff(prospect, profile, ctx, "", [], ""), [prospect, profile, ctx]);
  const id = preview.handoffId;
  const rmContext = notes[id] ?? "";
  const gaps = useMemo(() => checkProposal(profile, rmContext), [profile, rmContext]);
  const model = useMemo(() => proposalToDoc({ ...preview, rmContext: rmContext.trim() }), [preview, rmContext]);
  const subject = profile || NO_PROFILE;
  const log = (type: LogType, detail: string) => addLog({ type, subject, theme: theme.title, detail });
  const { busy, download } = useDownload(model, () => log("Downloaded", "Proposal hand-off (.docx)"));

  const send = () => {
    saveHandoff(buildProposalHandoff(prospect, profile, ctx, rmContext, gaps.map((gap) => gap.message)));
    log("Prospect", `Hand-off ${id} to Portfolio Proposal, ${gapSummary(gaps)}`);
    navigate(`/proposal/${id}`);
  };

  return (
    <Panel title={subject} subtitle={`Prospect · ${theme.title}`} theme={theme} document={model}>
      <ViewNote theme={theme} />
      <ContextBox id={id} kind="proposal" gaps={gaps} />
      <div className="grid gap-2">
        <button type="button" className={buttonPrimary} onClick={send}>
          Send to Portfolio Proposal
        </button>
        <button type="button" className={buttonSecondary} disabled={busy} onClick={download}>
          {busy ? "Preparing…" : "Download .docx"}
        </button>
      </div>
      <SentNote id={id} path={`/proposal/${id}`} />
      <p className="text-xs leading-relaxed text-muted">Internal document. It goes to the Proposal agent, not to the prospect.</p>
    </Panel>
  );
}

export function Act() {
  const { act, rm, date, upTo } = useApp();
  const actUpTo = act?.upTo ?? "morning";
  // Documents are built from the scan the RM made the selections on.
  const scan = useMemo(() => runScan({ date, rmId: rm.id, upTo: actUpTo }), [date, rm.id, actUpTo]);
  const ctx = useMemo<BuildContext>(() => ({ rm, date }), [rm, date]);

  const items = act?.items ?? [];
  const rowFor = (clientId: string) => scan.clients.find((row) => row.client.id === clientId);
  const talkingPoints = items.flatMap((item) => (item.kind === "talking-points" ? [rowFor(item.clientId)] : [])).filter((row) => !!row);
  const reviews = items.flatMap((item) => (item.kind === "portfolio-review" ? [rowFor(item.clientId)] : [])).filter((row) => !!row);
  const proposals = items.flatMap((item) => {
    if (item.kind !== "proposal") return [];
    const prospect = scan.prospectThemes.find((p) => p.theme.id === item.themeId);
    return prospect ? [{ prospect, profile: item.profile }] : [];
  });

  if (talkingPoints.length + reviews.length + proposals.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Nothing selected yet</h1>
        <p className="mt-3 text-muted">Choose clients or a prospect theme in the brief, then click Continue.</p>
        <Link to="/brief" className={`${buttonPrimary} mt-6`}>
          Open the brief
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-12 px-6 py-8">
      <div>
        <Link to="/brief" className="text-sm font-medium text-brand-tint hover:text-white">
          ← Back to the brief
        </Link>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-ink">Act on your selections</h1>
        <p className="mt-2 text-sm text-muted">
          {plural(talkingPoints.length, "set")} of talking points, {plural(reviews.length, "portfolio review hand-off")} and {plural(proposals.length, "prospect hand-off")}, drafted by
          the agent from the {actUpTo === "morning" ? "9 AM brief" : "13:45 ad hoc scan"}. Nothing leaves this page until you send it.
        </p>
        {actUpTo !== upTo && (
          <p className="mt-3 rounded-md border border-checkpoint/60 bg-checkpoint/10 px-3.5 py-2.5 text-sm text-checkpoint">
            The brief has changed since these documents were drafted. Go back to the brief and click Continue to refresh them.
          </p>
        )}
      </div>

      {talkingPoints.length > 0 && (
        <section>
          <SectionHeading title="Client talking points" hint="Refine each draft with the agent, then approve the version you want to send." />
          <div className="space-y-6">
            {talkingPoints.map((row) => (
              <TalkingPointsWorkspace key={row.client.id} row={row} ctx={ctx} scanKey={actUpTo} />
            ))}
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section>
          <SectionHeading title="Portfolio review hand-offs" hint="Input for the Portfolio Review agent, which has its own chat. Add context, check it, then send." />
          <div className="space-y-6">
            {reviews.map((row) => (
              <PortfolioReviewPanel key={row.client.id} row={row} ctx={ctx} />
            ))}
          </div>
        </section>
      )}

      {proposals.length > 0 && (
        <section>
          <SectionHeading title="Prospect hand-offs" hint="Input for the Proposal agent, which has its own chat. Add context, check it, then send." />
          <div className="space-y-6">
            {proposals.map(({ prospect, profile }) => (
              <ProposalPanel key={prospect.theme.id} prospect={prospect} profile={profile} ctx={ctx} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
