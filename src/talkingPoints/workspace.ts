import type { ChatMessage, ThemeType, TalkingPointsWording, TpVersion, TpWorkspace } from "../types";
import { sameWording } from "./lockedFacts";

// Version history and approval for one set of talking points (spec 1.2 and 1.4).
// Pure functions over TpWorkspace, so the rules can be tested without the UI.

export const OPENING_VIEW =
  "This theme is an opinion. What's your view: agree, disagree, or add context? Your notes will shape the talking points.";
export const OPENING_PULSE = "Here's a first draft. Tell me what to change.";

let counter = 0;
function messageId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

export function createWorkspace(draft: TalkingPointsWording, themeType: ThemeType, now: string, stressTest?: string): TpWorkspace {
  const opening: ChatMessage = {
    id: messageId(),
    role: "agent",
    text: themeType === "View" ? OPENING_VIEW : OPENING_PULSE,
    version: 1,
    ...(themeType === "View" && stressTest ? { hint: stressTest } : {}),
  };
  return {
    versions: [{ n: 1, wording: draft, origin: "draft", note: "Generated draft", createdAt: now }],
    viewing: 1,
    messages: [opening],
    rounds: 0,
    approval: null,
    unlocked: false,
  };
}

export function latestVersion(ws: TpWorkspace): TpVersion {
  return ws.versions[ws.versions.length - 1];
}

export function versionOf(ws: TpWorkspace, n: number): TpVersion {
  return ws.versions.find((version) => version.n === n) ?? latestVersion(ws);
}

/** Approved and not unlocked: chat, chips and restore are disabled. */
export function isLocked(ws: TpWorkspace): boolean {
  return ws.approval !== null && !ws.unlocked;
}

function addVersion(ws: TpWorkspace, wording: TalkingPointsWording, origin: TpVersion["origin"], note: string, now: string): TpWorkspace {
  const n = latestVersion(ws).n + 1;
  return {
    ...ws,
    versions: [...ws.versions, { n, wording, origin, note, createdAt: now }],
    viewing: n,
    // Any edit clears the approval: it applied to a specific earlier version.
    approval: null,
    unlocked: false,
  };
}

/** The RM sends an instruction. Counts as one chat round whether or not it changes the document. */
export function postInstruction(ws: TpWorkspace, text: string): TpWorkspace {
  if (isLocked(ws)) return ws;
  return { ...ws, rounds: ws.rounds + 1, messages: [...ws.messages, { id: messageId(), role: "rm", text }] };
}

/** The agent answers. A new version is created only when the wording actually changed. */
export function postResult(
  ws: TpWorkspace,
  result: { wording: TalkingPointsWording; reply: string; notice?: string; note: string },
  now: string,
): TpWorkspace {
  if (isLocked(ws)) return ws;
  const changed = !sameWording(result.wording, latestVersion(ws).wording);
  const next = changed ? addVersion(ws, result.wording, "chat", result.note, now) : ws;
  const reply: ChatMessage = {
    id: messageId(),
    role: "agent",
    text: result.reply,
    ...(changed ? { version: latestVersion(next).n } : {}),
    ...(result.notice ? { notice: result.notice } : {}),
  };
  return { ...next, messages: [...next.messages, reply] };
}

/** Restoring copies an earlier version forward as a new one. History is never deleted. */
export function restoreVersion(ws: TpWorkspace, n: number, now: string): TpWorkspace {
  if (isLocked(ws)) return ws;
  const source = ws.versions.find((version) => version.n === n);
  if (!source || source.n === latestVersion(ws).n) return ws;
  const next = addVersion(ws, source.wording, "restore", `Restored from v${n}`, now);
  const created = latestVersion(next).n;
  return {
    ...next,
    messages: [...next.messages, { id: messageId(), role: "agent", text: `Restored v${n} as v${created}.`, version: created }],
  };
}

export function viewVersion(ws: TpWorkspace, n: number): TpWorkspace {
  if (isLocked(ws) || !ws.versions.some((version) => version.n === n)) return ws;
  return { ...ws, viewing: n };
}

/** "I have reviewed this" applies to one specific version and locks it. */
export function approveVersion(ws: TpWorkspace, n: number, by: string, now: string): TpWorkspace {
  if (!ws.versions.some((version) => version.n === n)) return ws;
  return { ...ws, viewing: n, approval: { version: n, by, at: now }, unlocked: false };
}

/** Reopens the chat. The approval stands until the next edit. */
export function unlockToEdit(ws: TpWorkspace): TpWorkspace {
  return ws.approval ? { ...ws, unlocked: true } : ws;
}

export function withdrawApproval(ws: TpWorkspace): TpWorkspace {
  return { ...ws, approval: null, unlocked: false };
}

/** The version that download, copy, email and WhatsApp send: only ever the approved one. */
export function approvedVersion(ws: TpWorkspace): TpVersion | null {
  return ws.approval ? (ws.versions.find((version) => version.n === ws.approval?.version) ?? null) : null;
}
