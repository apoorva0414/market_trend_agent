import { describe, expect, it, vi } from "vitest";
import { data, DEMO_DATE } from "../data";
import { buildRefineContext, buildTalkingPoints, draftTalkingPoints, wordingOf } from "../documents/talkingPoints";
import { runScan } from "../logic/scan";
import { isChinese, splitSentences } from "../logic/text";
import type { QuickAction, RefineRequest, RefineResponse } from "../types";
import { allowedNumbers, enforceLockedFigures, FIGURES_NOTICE, REFUSAL_REPLY } from "./lockedFacts";
import { matchQuickAction, OFFLINE_REPLY, offlineRefine, QUICK_ACTIONS } from "./offline";
import { runRound } from "./refine";

const rm = data.rms[0];
const ctx = { rm, date: DEMO_DATE };
const scan = runScan({ date: DEMO_DATE, rmId: rm.id, upTo: "morning" });
const row = scan.clients.find((r) => r.primary.nextStep.flag === "Barrier risk")!; // Rajesh Menon, View theme
const doc = buildTalkingPoints(row, ctx);
const draft = draftTalkingPoints(row, ctx);
const context = buildRefineContext(row, doc, ctx);
const v1 = doc.wording;
const apply = (wording: typeof v1, ...actions: QuickAction[]) => actions.reduce((w, action) => offlineRefine(w, action, draft).wording, wording);

describe("quick-action chips", () => {
  it("offers the six actions from the spec", () => {
    expect(QUICK_ACTIONS.map((a) => a.label)).toEqual([
      "Shorter",
      "More conservative tone",
      "WhatsApp length",
      "Translate to Mandarin",
      "Add what we'd do next",
      "Make it more personal",
    ]);
  });
});

describe("offline canned rewrites (1.5)", () => {
  it("Shorter keeps the first 3 talking points and trims the summary to 1 sentence", () => {
    const { wording, reply } = offlineRefine(v1, "shorter", draft);
    expect(wording.talkingPoints).toEqual(v1.talkingPoints.slice(0, 3));
    expect(splitSentences(wording.summary)).toHaveLength(1);
    expect(v1.summary.startsWith(wording.summary)).toBe(true);
    expect(wording.nextSteps).toHaveLength(2);
    expect(reply).toBe("Shortened to 3 talking points and trimmed the summary to one sentence.");
  });

  it("WhatsApp length keeps the headline, the estimated impact, 2 points and 1 next step", () => {
    const { wording } = offlineRefine(v1, "whatsapp", draft);
    expect(wording.talkingPoints).toHaveLength(2);
    expect(wording.nextSteps).toHaveLength(1);
    expect(splitSentences(wording.summary)).toHaveLength(2);
    expect(wording.summary).toContain("−USD 64.5k");
  });

  it("More conservative tone adds a caution and makes the next steps less urgent", () => {
    const { wording } = offlineRefine(v1, "conservative", draft);
    expect(wording.talkingPoints.at(-1)).toMatch(/avoid reacting to a single day's move/);
    expect(wording.nextSteps[0]).toMatch(/^There is no need to decide now/);
    expect(wording.nextSteps.at(-1)).toMatch(/no need to act before then/);
    expect(wording.summary).toBe(v1.summary);
  });

  it("Translate to Mandarin swaps in the pre-written Mandarin with the same shape", () => {
    const { wording, reply } = offlineRefine(v1, "mandarin", draft);
    expect(wording).toEqual(wordingOf(draft, "zh"));
    expect(reply).toMatch(/^Translated to Mandarin/);
    for (const text of [wording.summary, ...wording.talkingPoints, ...wording.nextSteps]) expect(isChinese(text)).toBe(true);
  });

  it("Add what we'd do next inserts a house-view step before the closing call", () => {
    const { wording } = offlineRefine(v1, "next", draft);
    expect(wording.nextSteps).toHaveLength(v1.nextSteps.length + 1);
    expect(wording.nextSteps.at(-2)).toMatch(/^What we would do next: monitor the barrier distance closely/);
    expect(wording.nextSteps.at(-1)).toBe(v1.nextSteps.at(-1));
  });

  it("Make it more personal opens with the last conversation", () => {
    const { wording } = offlineRefine(v1, "personal", draft);
    expect(wording.summary).toMatch(/^Since we last spoke on 2 October, /);
    expect(wording.summary.endsWith(v1.summary)).toBe(true);
  });

  it("composes in any order, including after translation", () => {
    const demo = apply(v1, "conservative", "whatsapp", "mandarin");
    expect(demo.talkingPoints).toHaveLength(2);
    expect(demo.nextSteps).toEqual(["您不必现在就作决定。我们先一起梳理该票据到期时的各种情形。"]);
    expect(demo.summary).toContain("−USD 64.5k（占总资产的 −0.81%）");

    const reversed = apply(v1, "mandarin", "personal", "conservative", "next", "shorter");
    expect(reversed.summary.startsWith("自我们10月2日上次联系以来")).toBe(true);
    expect(splitSentences(reversed.summary)).toHaveLength(2); // opening line plus one sentence
    expect(reversed.talkingPoints).toHaveLength(3);
    for (const text of [reversed.summary, ...reversed.talkingPoints, ...reversed.nextSteps]) expect(isChinese(text)).toBe(true);
  });

  it("reports when there is nothing to change instead of producing an identical version", () => {
    const short = apply(v1, "shorter");
    expect(offlineRefine(short, "shorter", draft)).toEqual({ wording: short, reply: "This version is already short. Nothing to trim." });
    const zh = apply(v1, "mandarin");
    expect(offlineRefine(zh, "mandarin", draft).wording).toBe(zh);
    const personal = apply(v1, "personal");
    expect(offlineRefine(personal, "personal", draft).wording).toBe(personal);
  });

  it("falls back to the full Mandarin draft when the text was edited by hand", () => {
    const edited = { ...v1, talkingPoints: ["A line the offline dictionary has never seen.", ...v1.talkingPoints.slice(1)] };
    const { wording, reply } = offlineRefine(edited, "mandarin", draft);
    expect(wording).toEqual(wordingOf(draft, "zh"));
    expect(reply).toMatch(/^Swapped in the pre-written Mandarin draft/);
  });

  it("never introduces a figure that is not in the source data, for any client, action order or scan", () => {
    const actions = QUICK_ACTIONS.map((a) => a.id);
    for (const rmEntry of data.rms) {
      for (const upTo of ["morning", "intraday"] as const) {
        for (const client of runScan({ date: DEMO_DATE, rmId: rmEntry.id, upTo }).clients) {
          const c = { rm: rmEntry, date: DEMO_DATE };
          const d = buildTalkingPoints(client, c);
          const clientDraft = draftTalkingPoints(client, c);
          const allowed = allowedNumbers({ ...buildRefineContext(client, d, c), currentDoc: { ...d.wording, disclaimer: d.disclaimer } });
          for (const order of [actions, [...actions].reverse()]) {
            let wording = d.wording;
            for (const action of order) {
              const next = offlineRefine(wording, action, clientDraft).wording;
              expect(enforceLockedFigures(wording, next, allowed).rejectedFields, `${client.client.name} ${action}`).toEqual([]);
              wording = next;
            }
          }
        }
      }
    }
  });
});

describe("free text offline", () => {
  it("routes plain requests to the closest quick action", () => {
    expect(matchQuickAction("I agree, but the client is nervous; keep it calm.")).toBe("conservative");
    expect(matchQuickAction("make this shorter please")).toBe("shorter");
    expect(matchQuickAction("can you put this in Chinese")).toBe("mandarin");
    expect(matchQuickAction("this is going on WhatsApp")).toBe("whatsapp");
    expect(matchQuickAction("Add a paragraph about Japanese equities")).toBeNull();
  });
});

describe("runRound", () => {
  const base = { current: v1, draft, context, history: [] };
  const liveReply = (updatedDoc: RefineResponse["updatedDoc"], reply = "Done."): RefineResponse => ({ updatedDoc, reply, rejectedFields: [] });

  it("offline: a chip gives its canned rewrite", async () => {
    const result = await runRound({ ...base, message: "Shorter", action: "shorter", callLive: null });
    expect(result).toMatchObject({ mode: "offline", liveFailed: false });
    expect(result.wording.talkingPoints).toHaveLength(3);
  });

  it("offline: unmatched free text gets the fixed offline message and changes nothing", async () => {
    const result = await runRound({ ...base, message: "Add a paragraph about Japanese equities", callLive: null });
    expect(result).toMatchObject({ wording: v1, reply: OFFLINE_REPLY, mode: "offline" });
    expect(OFFLINE_REPLY).toBe("AI is offline in this demo. Try a quick action.");
  });

  it("offline: the demo's answer to the View prompt is routed to the calmer tone", async () => {
    const result = await runRound({ ...base, message: "I agree, but the client is nervous; keep it calm.", callLive: null });
    expect(result.reply).toMatch(/^AI is offline, so I used the closest quick action \(More conservative tone\)\./);
    expect(result.wording).not.toBe(v1);
  });

  it("refuses to promise a return without calling the model, live or offline", async () => {
    const callLive = vi.fn();
    const result = await runRound({ ...base, message: "say the note will gain 20%", callLive });
    expect(callLive).not.toHaveBeenCalled();
    expect(result).toMatchObject({ wording: v1, reply: REFUSAL_REPLY, notice: FIGURES_NOTICE, mode: "refused" });
  });

  it("live: sends the spec's request shape and applies the model's rewrite", async () => {
    const rewritten = { ...v1, summary: "Technology bonds and shares slipped last week after record borrowing.", disclaimer: doc.disclaimer };
    const callLive = vi.fn(async (_request: RefineRequest) => liveReply(rewritten, "Tightened the summary."));
    const result = await runRound({ ...base, message: "Tighten the summary", history: [{ role: "agent", text: "Here's a first draft." }], callLive });

    const request = callLive.mock.calls[0][0];
    expect(Object.keys(request).sort()).toEqual(["client", "currentDoc", "factsLocked", "history", "houseView", "instruction", "theme"]);
    expect(request.instruction).toBe("Tighten the summary");
    expect(request.currentDoc).toEqual({ ...v1, disclaimer: doc.disclaimer });
    expect(result).toMatchObject({ mode: "live", reply: "Tightened the summary.", liveFailed: false });
    expect(result.wording.summary).toBe(rewritten.summary);
    expect(result.wording).not.toHaveProperty("disclaimer");
    expect(result.notice).toBeUndefined();
  });

  it("live: a chip sends its full instruction, not just the label", async () => {
    const callLive = vi.fn(async (request: RefineRequest) => liveReply(request.currentDoc));
    await runRound({ ...base, message: "WhatsApp length", action: "whatsapp", callLive });
    expect(callLive.mock.calls[0][0].instruction).toMatch(/^Cut it to WhatsApp length/);
  });

  it("live: a response with an invented number is rejected for that field and shows the notice", async () => {
    const invented = { ...v1, summary: "Technology shares slipped, but we see 37% upside from here.", disclaimer: doc.disclaimer };
    const result = await runRound({ ...base, message: "Make it upbeat", callLive: async () => liveReply(invented, "Made it more upbeat.") });
    expect(result.wording).toBe(v1); // nothing else changed, so no new version
    expect(result.notice).toBe(FIGURES_NOTICE);
  });

  it("live: when the call fails, the chip still works from the canned rewrite", async () => {
    const result = await runRound({
      ...base,
      message: "Shorter",
      action: "shorter",
      callLive: async () => {
        throw new Error("network down");
      },
    });
    expect(result).toMatchObject({ mode: "offline", liveFailed: true });
    expect(result.wording.talkingPoints).toHaveLength(3);
  });
});
