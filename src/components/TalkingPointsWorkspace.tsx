import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { refineLive } from "../ai/client";
import type { BuildContext } from "../documents/builders";
import { docToText, talkingPointsMessage, talkingPointsToDoc } from "../documents/model";
import { buildRefineContext, buildTalkingPoints, draftTalkingPoints } from "../documents/talkingPoints";
import { fmtTimeSgt, plural } from "../logic/format";
import { sameWording } from "../talkingPoints/lockedFacts";
import { QUICK_ACTIONS } from "../talkingPoints/offline";
import { runRound } from "../talkingPoints/refine";
import {
  approvedVersion,
  approveVersion,
  createWorkspace,
  isLocked,
  latestVersion,
  postInstruction,
  postResult,
  restoreVersion,
  unlockToEdit,
  versionOf,
  viewVersion,
  withdrawApproval,
} from "../talkingPoints/workspace";
import { useApp } from "../state/AppContext";
import type { ChatMessage, QuickAction, RankedClient, TpWorkspace } from "../types";
import { TalkingPointsView } from "./TalkingPointsView";
import {
  AgentLabel,
  buttonDisabledLink,
  buttonPrimary,
  buttonSecondary,
  card,
  DecisionLabel,
  decisionOutline,
  eyebrow,
  fieldInput,
  LockIcon,
  textLink,
  TypeBadge,
} from "./ui";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and non-secure contexts: fall back to a hidden textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function AiStatusDot() {
  const { aiStatus } = useApp();
  const label = aiStatus === "live" ? "AI: live" : aiStatus === "offline" ? "AI: offline" : "AI: checking";
  const title =
    aiStatus === "live"
      ? "Chat is answered by the Claude API through the local endpoint."
      : "No API endpoint or key is available. Quick actions use prepared rewrites.";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted" title={title}>
      <span className={`h-2 w-2 rounded-full ${aiStatus === "live" ? "bg-gain" : aiStatus === "offline" ? "bg-muted/60" : "animate-pulse bg-checkpoint"}`} />
      {label}
    </span>
  );
}

function Message({ message }: { message: ChatMessage }) {
  if (message.role === "rm") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[88%] rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-white">{message.text}</p>
      </div>
    );
  }
  return (
    <div className="max-w-[94%]">
      <div className="rounded-lg rounded-bl-sm border border-brand/35 bg-brand/12 px-3 py-2 text-sm leading-relaxed text-ink">
        {message.text}
        {message.version !== undefined && message.version > 1 && (
          <span className="ml-2 rounded bg-raised px-1.5 py-0.5 text-[11px] font-semibold text-brand-tint">v{message.version}</span>
        )}
      </div>
      {message.hint && <p className="mt-1.5 px-1 text-xs leading-relaxed text-muted">Worth testing: {message.hint}</p>}
      {message.notice && (
        <p className="mt-1.5 flex items-start gap-1.5 px-1 text-xs leading-relaxed text-checkpoint">
          <LockIcon className="mt-0.5 h-3 w-3 shrink-0" />
          {message.notice}
        </p>
      )}
    </div>
  );
}

interface Props {
  row: RankedClient;
  ctx: BuildContext;
  /** Which scan the documents were drafted from. A new scan starts a fresh workspace. */
  scanKey: string;
}

/**
 * Two-column workspace for one set of client talking points (update spec section 1):
 * the document on the left, the chat with the agent on the right, and the final check below it.
 */
export function TalkingPointsWorkspace({ row, ctx, scanKey }: Props) {
  const { workspaces, updateWorkspace, aiStatus, markAiOffline, addLog } = useApp();
  const { client } = row;
  const theme = row.primary.theme;
  const rmName = ctx.rm.name;

  const doc = useMemo(() => buildTalkingPoints(row, ctx), [row, ctx]);
  const draft = useMemo(() => draftTalkingPoints(row, ctx), [row, ctx]);
  const context = useMemo(() => buildRefineContext(row, doc, ctx), [row, doc, ctx]);
  const key = `${doc.id}@${scanKey}`;
  const initial = useMemo(() => createWorkspace(doc.wording, theme.type, new Date().toISOString(), theme.stressTest), [doc, theme]);
  const ws: TpWorkspace = workspaces[key] ?? initial;
  const change = useCallback((fn: (current: TpWorkspace) => TpWorkspace) => updateWorkspace(key, initial, fn), [updateWorkspace, key, initial]);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [flashVersion, setFlashVersion] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const messageCount = ws.messages.length;
  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [messageCount, busy]);

  const latest = latestVersion(ws);
  const viewing = versionOf(ws, ws.viewing);
  const previous = ws.versions.find((version) => version.n === viewing.n - 1) ?? null;
  const approved = approvedVersion(ws);
  const locked = isLocked(ws);
  const rounds = plural(ws.rounds, "chat round");
  const chatDisabled = locked || busy;

  const send = async (message: string, action?: QuickAction) => {
    const text = message.trim();
    if (!text || chatDisabled) return;
    const before = latest;
    const history = ws.messages.map((m) => ({ role: m.role, text: m.text }));
    setInput("");
    setBusy(true);
    change((current) => postInstruction(current, text));
    try {
      const result = await runRound({
        current: before.wording,
        message: text,
        action,
        draft,
        context,
        history,
        callLive: aiStatus === "live" ? refineLive : null,
      });
      if (result.liveFailed) markAiOffline();
      const note = action ? (QUICK_ACTIONS.find((a) => a.id === action)?.label ?? text) : text.length > 44 ? `${text.slice(0, 43)}…` : text;
      change((current) => postResult(current, { wording: result.wording, reply: result.reply, notice: result.notice, note }, new Date().toISOString()));
      if (!sameWording(result.wording, before.wording)) {
        // Briefly highlight what changed; the tint fades after about 3 seconds.
        setFlashVersion(before.n + 1);
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlashVersion(null), 3200);
      }
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  const log = (type: "Approved" | "Shared", detail: string) => addLog({ type, subject: client.name, theme: theme.title, detail });

  const onReviewed = (checked: boolean) => {
    if (!checked) {
      change(withdrawApproval);
      return;
    }
    change((current) => approveVersion(current, viewing.n, rmName, new Date().toISOString()));
    log("Approved", `Talking points approved · v${viewing.n} · ${rounds}`);
  };

  // Download, copy, email and WhatsApp only ever use the approved version.
  const shareModel = approved ? talkingPointsToDoc(doc, approved.wording, approved.n) : null;
  const shareMessage = approved ? talkingPointsMessage(doc, approved.wording, rmName) : null;
  const shared = (channel: "Email" | "WhatsApp" | "Download" | "Copy") => {
    if (approved) log("Shared", `Shared via ${channel} · v${approved.n} · ${rounds}`);
  };

  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    if (!shareModel) return;
    setDownloading(true);
    try {
      // The docx library is large, so it is loaded only when a download is requested.
      const { downloadDocx } = await import("../documents/docx");
      await downloadDocx(shareModel);
      shared("Download");
    } finally {
      setDownloading(false);
    }
  };
  const copy = async () => {
    if (!shareModel || !(await copyToClipboard(docToText(shareModel)))) return;
    shared("Copy");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const reviewedId = `reviewed-${key}`;
  const versionId = `version-${key}`;
  const changesId = `changes-${key}`;

  return (
    <section className={`${card} p-5`}>
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold text-ink">{client.name}</h3>
        <span className="text-sm text-muted">
          {client.mandate} · {client.riskProfile} · {theme.title}
        </span>
        <TypeBadge type={theme.type} />
        {doc.flag && <span className="rounded border border-loss/50 bg-bg px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-loss uppercase">{doc.flag}</span>}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        {/* Left: the document */}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label htmlFor={versionId} className={eyebrow}>
              Version
            </label>
            <select
              id={versionId}
              value={viewing.n}
              disabled={locked}
              onChange={(event) => change((current) => viewVersion(current, Number(event.target.value)))}
              className={`${fieldInput} max-w-[18rem] py-1.5 pr-8 pl-2.5 text-sm`}
            >
              {ws.versions.map((version) => (
                <option key={version.n} value={version.n}>
                  v{version.n} · {version.note}
                  {version.n === latest.n ? " (latest)" : ""}
                  {version.n === approved?.n ? " (approved)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${buttonSecondary} px-3 py-1.5`}
              disabled={locked || viewing.n === latest.n}
              onClick={() => change((current) => restoreVersion(current, viewing.n, new Date().toISOString()))}
            >
              Restore
            </button>
            <label htmlFor={changesId} className={`flex items-center gap-2 text-sm ${previous ? "text-soft" : "text-muted/60"}`}>
              <input
                id={changesId}
                type="checkbox"
                checked={showChanges && previous !== null}
                disabled={previous === null}
                onChange={(event) => setShowChanges(event.target.checked)}
                className="h-4 w-4 accent-brand-tint"
              />
              Show changes
            </label>
          </div>
          {viewing.n !== latest.n && !locked && (
            <p className="mb-3 text-xs text-muted">
              Viewing v{viewing.n}. New edits apply to the latest version (v{latest.n}). Restore copies this version forward as v{latest.n + 1}.
            </p>
          )}
          {showChanges && previous && (
            <p className="mb-3 text-xs text-muted">
              Compared with v{previous.n}: <ins className="rounded-sm bg-gain/20 px-1 text-ink no-underline">added</ins>{" "}
              <del className="rounded-sm bg-bg/70 px-1 text-loss">removed</del>
            </p>
          )}
          <TalkingPointsView
            doc={doc}
            wording={viewing.wording}
            version={viewing.n}
            previous={previous?.wording ?? null}
            showChanges={showChanges}
            flash={flashVersion === viewing.n}
          />
        </div>

        {/* Right: the chat, then the final check */}
        <aside className="space-y-4 lg:sticky lg:top-28">
          <div className="overflow-hidden rounded-lg border border-line bg-bg">
            <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
              <AgentLabel />
              <AiStatusDot />
            </div>

            <div ref={thread} className="max-h-[22rem] min-h-[9rem] space-y-3 overflow-y-auto px-3.5 py-3.5" aria-live="polite">
              {ws.messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {busy && <p className="px-1 text-xs text-muted">Working on it…</p>}
            </div>

            <div className="border-t border-line p-3.5">
              {locked ? (
                <p className="flex items-start gap-2 text-sm leading-relaxed text-muted">
                  <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Chat is locked while v{approved?.n} is approved. Unlock to edit.
                </p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        disabled={chatDisabled}
                        onClick={() => void send(action.label, action.id)}
                        className="rounded-full border border-line bg-raised px-2.5 py-1 text-xs font-medium text-soft transition-colors hover:border-brand-tint hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={onKeyDown}
                      disabled={chatDisabled}
                      rows={2}
                      placeholder="Add your notes or ask for a change…"
                      aria-label={`Message to the agent about ${client.name}`}
                      className={`${fieldInput} min-w-0 flex-1 resize-none px-3 py-2 text-sm`}
                    />
                    <button type="button" className={`${buttonPrimary} px-3`} disabled={chatDisabled || input.trim() === ""} onClick={() => void send(input)}>
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={`rounded-lg bg-surface p-3.5 ${decisionOutline}`}>
            <DecisionLabel>Final check · RM decision</DecisionLabel>
            <label htmlFor={reviewedId} className="mt-1.5 flex items-center gap-2.5 text-sm font-semibold text-ink">
              <input
                id={reviewedId}
                type="checkbox"
                checked={approved?.n === viewing.n}
                disabled={busy}
                onChange={(event) => onReviewed(event.target.checked)}
                className="h-4 w-4 accent-checkpoint"
              />
              I have reviewed this
              <span className="font-normal text-muted">(v{viewing.n})</span>
            </label>

            {approved && ws.approval ? (
              <div className="mt-3 rounded-md border border-gain/40 bg-gain/12 px-3 py-2 text-sm text-gain" role="status">
                <p className="font-semibold">
                  v{approved.n} approved by {ws.approval.by} at {fmtTimeSgt(ws.approval.at)}
                </p>
                {locked ? (
                  <button type="button" className={`${textLink} mt-1 text-sm`} onClick={() => change(unlockToEdit)}>
                    Unlock to edit
                  </button>
                ) : (
                  <p className="mt-1 text-xs leading-relaxed">Unlocked. Any further edit clears this approval.</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Approving locks this version. Download and share stay off until then, and only the approved version is sent. The agent never contacts
                clients.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={buttonPrimary} disabled={!approved || downloading} onClick={download}>
              {downloading ? "Preparing…" : "Download .docx"}
            </button>
            <button type="button" className={buttonSecondary} disabled={!approved} onClick={copy}>
              {copied ? "Copied" : "Copy text"}
            </button>
            {approved && shareMessage ? (
              <>
                <a
                  className={buttonSecondary}
                  href={`mailto:?subject=${encodeURIComponent(shareMessage.subject)}&body=${encodeURIComponent(shareMessage.body)}`}
                  onClick={() => shared("Email")}
                >
                  Share by email
                </a>
                <a
                  className={buttonSecondary}
                  href={`https://wa.me/?text=${encodeURIComponent(shareMessage.body)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => shared("WhatsApp")}
                >
                  Share on WhatsApp
                </a>
              </>
            ) : (
              <>
                <button type="button" className={buttonDisabledLink} disabled>
                  Share by email
                </button>
                <button type="button" className={buttonDisabledLink} disabled>
                  Share on WhatsApp
                </button>
              </>
            )}
          </div>

          {shareMessage && (
            <details className="text-sm">
              <summary className="font-medium text-brand-tint select-none hover:text-white">Show the email and WhatsApp text (v{approved?.n})</summary>
              <p className="mt-2 text-xs text-muted">Subject: {shareMessage.subject}</p>
              <textarea
                readOnly
                value={shareMessage.body}
                rows={10}
                aria-label="Message text"
                onFocus={(event) => event.currentTarget.select()}
                className={`${fieldInput} mt-1.5 w-full p-2.5 font-mono text-xs leading-relaxed`}
              />
            </details>
          )}
        </aside>
      </div>
    </section>
  );
}
