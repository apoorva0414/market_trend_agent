import type { BilingualDraft } from "../documents/talkingPoints";
import type { QuickAction, RefineRequest, RefineResponse, TalkingPointsWording } from "../types";
import { allowedNumbers, asksForPromisedReturn, enforceLockedFigures, FIGURES_NOTICE, REFUSAL_REPLY, sameWording } from "./lockedFacts";
import { matchQuickAction, OFFLINE_REPLY, offlineRefine, QUICK_ACTIONS } from "./offline";

export interface RoundInput {
  current: TalkingPointsWording;
  /** What the RM typed, or the label of the chip they clicked. */
  message: string;
  action?: QuickAction;
  draft: BilingualDraft;
  context: Pick<RefineRequest, "factsLocked" | "theme" | "client" | "houseView">;
  history: RefineRequest["history"];
  /** Null when AI is offline. */
  callLive: ((request: RefineRequest) => Promise<RefineResponse>) | null;
}

export interface RoundResult {
  wording: TalkingPointsWording;
  reply: string;
  notice?: string;
  mode: "live" | "offline" | "refused";
  /** True when a live call was attempted and failed, so the caller can switch the status dot to offline. */
  liveFailed: boolean;
}

/** One chat round: guard the instruction, try the live model, fall back to canned rewrites, enforce locked figures. */
export async function runRound(input: RoundInput): Promise<RoundResult> {
  const { current, message, action, draft, context, history, callLive } = input;

  if (asksForPromisedReturn(message)) {
    return { wording: current, reply: REFUSAL_REPLY, notice: FIGURES_NOTICE, mode: "refused", liveFailed: false };
  }

  const currentDoc = { ...current, disclaimer: context.factsLocked.disclaimer };
  const allowed = allowedNumbers({ ...context, currentDoc });
  const instruction = action ? (QUICK_ACTIONS.find((a) => a.id === action)?.instruction ?? message) : message;

  let liveFailed = false;
  if (callLive) {
    try {
      const response = await callLive({ ...context, currentDoc, instruction, history });
      const checked = enforceLockedFigures(current, response.updatedDoc, allowed);
      const rejected = checked.rejectedFields.length > 0 || response.rejectedFields.length > 0;
      return {
        wording: sameWording(checked.wording, current) ? current : pickWording(checked.wording),
        reply: response.reply,
        ...(rejected ? { notice: FIGURES_NOTICE } : {}),
        mode: "live",
        liveFailed: false,
      };
    } catch {
      liveFailed = true;
    }
  }

  const matched = action ?? matchQuickAction(message);
  if (!matched) return { wording: current, reply: OFFLINE_REPLY, mode: "offline", liveFailed };

  const canned = offlineRefine(current, matched, draft);
  const checked = enforceLockedFigures(current, canned.wording, allowed);
  const label = QUICK_ACTIONS.find((a) => a.id === matched)?.label ?? matched;
  return {
    wording: sameWording(checked.wording, current) ? current : checked.wording,
    reply: action ? canned.reply : `AI is offline, so I used the closest quick action (${label}). ${canned.reply}`,
    ...(checked.rejectedFields.length > 0 ? { notice: FIGURES_NOTICE } : {}),
    mode: "offline",
    liveFailed,
  };
}

function pickWording(doc: TalkingPointsWording): TalkingPointsWording {
  return { summary: doc.summary, talkingPoints: doc.talkingPoints, nextSteps: doc.nextSteps };
}
