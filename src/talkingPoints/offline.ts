import type { BilingualDraft, Lang, Line } from "../documents/talkingPoints";
import { isChinese, joinSentences, splitSentences } from "../logic/text";
import type { QuickAction, TalkingPointsWording } from "../types";
import { sameWording } from "./lockedFacts";

// Offline fallback (spec 1.5). When there is no API key, no endpoint, or a call fails, the quick
// actions still work as deterministic template transforms. They only select, swap or add sentences
// that were written in advance, so they can never change a figure.

export const QUICK_ACTIONS: { id: QuickAction; label: string; instruction: string }[] = [
  { id: "shorter", label: "Shorter", instruction: "Make it shorter: at most 3 talking points, a one-sentence summary and 2 next steps." },
  { id: "conservative", label: "More conservative tone", instruction: "Use a more conservative, calmer tone. Do not create urgency." },
  { id: "whatsapp", label: "WhatsApp length", instruction: "Cut it to WhatsApp length: a two-sentence summary, 2 short talking points and 1 next step." },
  { id: "mandarin", label: "Translate to Mandarin", instruction: "Translate the wording to Mandarin (Simplified Chinese). Keep all figures, currency amounts and product names exactly as written." },
  { id: "next", label: "Add what we'd do next", instruction: "Add one next step that says what we would do next, based on the house view." },
  { id: "personal", label: "Make it more personal", instruction: "Make it more personal: open by referring to our last conversation." },
];

export const OFFLINE_REPLY = "AI is offline in this demo. Try a quick action.";

/** Maps free text to the closest quick action, so plain requests such as "keep it calm" still work offline. */
export function matchQuickAction(text: string): QuickAction | null {
  const rules: [RegExp, QuickAction][] = [
    [/whats\s?app|text message|\bsms\b/i, "whatsapp"],
    [/mandarin|chinese|中文|华语|translate/i, "mandarin"],
    [/\b(short(er|en)?|brief(er)?|concise|trim|cut (it )?down)\b/i, "shorter"],
    [/\b(calm(er|ly)?|nervous|worried|anxious|cautious|conservative|careful|reassur\w*|soften|gentle|less urgent)\b/i, "conservative"],
    [/\b(personal|warm(er)?|friendl(y|ier))\b/i, "personal"],
    [/next step|what we.?d do|do next|what would (you|we) do/i, "next"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

interface Kit {
  toZh: Map<string, string>;
  calmer: Map<string, string>;
  impact: Record<Lang, string[]>;
  caution: Line;
  personal: Line;
  nextAction: Line;
  closing: Set<string>;
  zhDraft: TalkingPointsWording;
}

function buildKit(draft: BilingualDraft): Kit {
  const lines = [...draft.summary, ...draft.talkingPoints, ...draft.nextSteps, draft.caution, draft.personal, draft.nextAction];
  const toZh = new Map<string, string>();
  const calmer = new Map<string, string>();
  for (const line of lines) {
    toZh.set(line.en, line.zh);
    if (line.calm) {
      toZh.set(line.calm.en, line.calm.zh);
      calmer.set(line.en, line.calm.en);
      calmer.set(line.zh, line.calm.zh);
    }
  }
  const last = draft.nextSteps[draft.nextSteps.length - 1];
  return {
    toZh,
    calmer,
    impact: { en: draft.impact.map((l) => l.en), zh: draft.impact.map((l) => l.zh) },
    caution: draft.caution,
    personal: draft.personal,
    nextAction: draft.nextAction,
    closing: new Set([last.en, last.zh, ...(last.calm ? [last.calm.en, last.calm.zh] : [])]),
    zhDraft: {
      summary: joinSentences(draft.summary.map((l) => l.zh)),
      talkingPoints: draft.talkingPoints.map((l) => l.zh),
      nextSteps: draft.nextSteps.map((l) => l.zh),
    },
  };
}

function languageOf(wording: TalkingPointsWording): Lang {
  return isChinese(wording.summary + wording.talkingPoints.join("")) ? "zh" : "en";
}

/** Applies one quick action as a canned rewrite. Returns the same wording when there is nothing to change. */
export function offlineRefine(
  current: TalkingPointsWording,
  action: QuickAction,
  draft: BilingualDraft,
): { wording: TalkingPointsWording; reply: string } {
  const kit = buildKit(draft);
  const lang = languageOf(current);
  const sentences = splitSentences(current.summary);
  const opener = kit.personal[lang];
  const hasOpener = sentences.includes(opener);
  const core = sentences.filter((sentence) => sentence !== opener);
  const done = (wording: TalkingPointsWording, reply: string, unchangedReply: string) =>
    sameWording(wording, current) ? { wording: current, reply: unchangedReply } : { wording, reply };

  switch (action) {
    case "shorter": {
      const wording = {
        summary: joinSentences([...(hasOpener ? [opener] : []), ...core.slice(0, 1)]),
        talkingPoints: current.talkingPoints.slice(0, 3),
        nextSteps: current.nextSteps.slice(0, 2),
      };
      return done(
        wording,
        `Shortened to ${wording.talkingPoints.length} talking points and trimmed the summary to one sentence.`,
        "This version is already short. Nothing to trim.",
      );
    }
    case "whatsapp": {
      const impact = core.find((sentence) => kit.impact[lang].includes(sentence));
      const kept = impact && impact !== core[0] ? [core[0], impact] : core.slice(0, 2);
      const wording = {
        summary: joinSentences([...(hasOpener ? [opener] : []), ...kept]),
        talkingPoints: current.talkingPoints.slice(0, 2),
        nextSteps: current.nextSteps.slice(0, 1),
      };
      return done(
        wording,
        `Cut to WhatsApp length: ${wording.talkingPoints.length} key points and one next step.`,
        "This version is already at WhatsApp length.",
      );
    }
    case "conservative": {
      const caution = kit.caution[lang];
      const wording = {
        summary: current.summary,
        talkingPoints: current.talkingPoints.includes(caution) ? current.talkingPoints : [...current.talkingPoints, caution],
        nextSteps: current.nextSteps.map((step) => kit.calmer.get(step) ?? step),
      };
      return done(
        wording,
        "Softened the tone: the next steps are less urgent and there is a line on not reacting to one day's move.",
        "This version already uses the calmer wording.",
      );
    }
    case "mandarin": {
      if (lang === "zh") return { wording: current, reply: "This version is already in Mandarin." };
      const translate = (text: string) => kit.toZh.get(text);
      const summary = sentences.map(translate);
      const talkingPoints = current.talkingPoints.map(translate);
      const nextSteps = current.nextSteps.map(translate);
      const complete = [...summary, ...talkingPoints, ...nextSteps].every((text) => text !== undefined);
      // Text the offline dictionary has never seen (for example a live AI edit) cannot be translated
      // sentence by sentence, so the full pre-written Mandarin draft is swapped in instead.
      if (!complete) return { wording: kit.zhDraft, reply: "Swapped in the pre-written Mandarin draft. Figures and product names are unchanged." };
      return {
        wording: { summary: (summary as string[]).join(""), talkingPoints: talkingPoints as string[], nextSteps: nextSteps as string[] },
        reply: "Translated to Mandarin. Figures and product names are unchanged.",
      };
    }
    case "next": {
      const addition = kit.nextAction[lang];
      if (current.nextSteps.includes(addition)) return { wording: current, reply: "What we would do next is already included." };
      const steps = [...current.nextSteps];
      const lastIsClosing = steps.length > 0 && kit.closing.has(steps[steps.length - 1]);
      steps.splice(lastIsClosing ? steps.length - 1 : steps.length, 0, addition);
      return { wording: { ...current, nextSteps: steps }, reply: "Added what we would do next, based on the house view." };
    }
    case "personal": {
      if (hasOpener) return { wording: current, reply: "The personal opening is already there." };
      return {
        wording: { ...current, summary: joinSentences([opener, ...sentences]) },
        reply: "Added a personal opening that refers to your last conversation.",
      };
    }
  }
}
