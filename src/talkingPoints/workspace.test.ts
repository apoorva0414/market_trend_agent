import { describe, expect, it } from "vitest";
import type { TalkingPointsWording } from "../types";
import { diffLines, diffWords, newLines } from "./diff";
import {
  approvedVersion,
  approveVersion,
  createWorkspace,
  isLocked,
  latestVersion,
  OPENING_PULSE,
  OPENING_VIEW,
  postInstruction,
  postResult,
  restoreVersion,
  unlockToEdit,
  versionOf,
  viewVersion,
  withdrawApproval,
} from "./workspace";

const NOW = "2026-10-12T02:42:00.000Z";
const draft: TalkingPointsWording = { summary: "One. Two.", talkingPoints: ["a", "b", "c", "d"], nextSteps: ["x", "y"] };
const shorter: TalkingPointsWording = { summary: "One.", talkingPoints: ["a", "b", "c"], nextSteps: ["x", "y"] };
const whatsapp: TalkingPointsWording = { summary: "One.", talkingPoints: ["a", "b"], nextSteps: ["x"] };

function round(ws: ReturnType<typeof createWorkspace>, message: string, wording: TalkingPointsWording, reply = "Done.", notice?: string) {
  return postResult(postInstruction(ws, message), { wording, reply, note: message, ...(notice ? { notice } : {}) }, NOW);
}

describe("opening message (1.1)", () => {
  it("asks for the RM's view on a View theme", () => {
    const ws = createWorkspace(draft, "View", NOW, "Check it against the next inflation release.");
    expect(ws.messages).toHaveLength(1);
    expect(ws.messages[0]).toMatchObject({ role: "agent", text: OPENING_VIEW, hint: "Check it against the next inflation release." });
    expect(OPENING_VIEW).toBe("This theme is an opinion. What's your view: agree, disagree, or add context? Your notes will shape the talking points.");
  });

  it("offers the first draft on a Pulse theme", () => {
    const ws = createWorkspace(draft, "Pulse", NOW);
    expect(ws.messages[0].text).toBe(OPENING_PULSE);
    expect(OPENING_PULSE).toBe("Here's a first draft. Tell me what to change.");
  });
});

describe("versions (1.2)", () => {
  const v1 = createWorkspace(draft, "View", NOW);

  it("starts at v1 with the generated draft", () => {
    expect(v1.versions.map((v) => v.n)).toEqual([1]);
    expect(latestVersion(v1)).toMatchObject({ origin: "draft", wording: draft });
  });

  it("creates a new version for every chat round that changes the document", () => {
    const v3 = round(round(v1, "Shorter", shorter), "WhatsApp length", whatsapp);
    expect(v3.versions.map((v) => v.n)).toEqual([1, 2, 3]);
    expect(v3.viewing).toBe(3);
    expect(v3.rounds).toBe(2);
    expect(v3.messages.at(-1)).toMatchObject({ role: "agent", version: 3 });
    expect(versionOf(v3, 2).note).toBe("Shorter");
  });

  it("counts a refused round but does not create a version for it", () => {
    const v2 = round(v1, "Shorter", shorter);
    const refused = round(v2, "say the note will gain 20%", shorter, "I can't write that.", "Kept the original figures.");
    expect(refused.versions).toHaveLength(2);
    expect(refused.rounds).toBe(2);
    expect(refused.messages.at(-1)).toMatchObject({ text: "I can't write that.", notice: "Kept the original figures." });
    expect(refused.messages.at(-1)?.version).toBeUndefined();
  });

  it("restores an earlier version as a new one and never deletes history", () => {
    const v3 = round(round(v1, "Shorter", shorter), "WhatsApp length", whatsapp);
    const restored = restoreVersion(v3, 1, NOW);
    expect(restored.versions.map((v) => v.n)).toEqual([1, 2, 3, 4]);
    expect(latestVersion(restored)).toMatchObject({ n: 4, origin: "restore", note: "Restored from v1", wording: draft });
    expect(restored.versions.slice(0, 3)).toEqual(v3.versions);
    expect(restored.viewing).toBe(4);
    expect(restoreVersion(v3, 3, NOW)).toBe(v3); // restoring the latest is a no-op
  });

  it("lets the RM look at any earlier version", () => {
    const v3 = round(round(v1, "Shorter", shorter), "WhatsApp length", whatsapp);
    expect(viewVersion(v3, 1).viewing).toBe(1);
    expect(viewVersion(v3, 9)).toBe(v3);
  });
});

describe("final check (1.4)", () => {
  const v3 = round(round(createWorkspace(draft, "View", NOW), "Shorter", shorter), "WhatsApp length", whatsapp);
  const approved = approveVersion(v3, 3, "Kevin Tan", NOW);

  it("approves one specific version and locks it", () => {
    expect(approved.approval).toEqual({ version: 3, by: "Kevin Tan", at: NOW });
    expect(isLocked(approved)).toBe(true);
    expect(approvedVersion(approved)?.wording).toBe(whatsapp);
    expect(approvedVersion(v3)).toBeNull(); // nothing can be shared before approval
  });

  it("ignores chat, chips and restore while locked", () => {
    expect(postInstruction(approved, "Shorter")).toBe(approved);
    expect(postResult(approved, { wording: draft, reply: "x", note: "x" }, NOW)).toBe(approved);
    expect(restoreVersion(approved, 1, NOW)).toBe(approved);
    expect(viewVersion(approved, 1)).toBe(approved);
  });

  it("keeps the approval after Unlock to edit, until the next edit clears it", () => {
    const unlocked = unlockToEdit(approved);
    expect(isLocked(unlocked)).toBe(false);
    expect(approvedVersion(unlocked)?.n).toBe(3);

    const edited = round(unlocked, "Make it more personal", { ...whatsapp, summary: "Hello. One." });
    expect(edited.approval).toBeNull();
    expect(edited.unlocked).toBe(false);
    expect(approvedVersion(edited)).toBeNull();
    expect(latestVersion(edited).n).toBe(4);
  });

  it("clears the approval when an unlocked RM restores an older version", () => {
    expect(restoreVersion(unlockToEdit(approved), 1, NOW).approval).toBeNull();
  });

  it("always shares the approved version, even while another one is on screen", () => {
    const browsing = viewVersion(unlockToEdit(approved), 1);
    expect(browsing.viewing).toBe(1);
    expect(approvedVersion(browsing)?.n).toBe(3);
  });

  it("can be withdrawn by unticking", () => {
    expect(withdrawApproval(approved)).toMatchObject({ approval: null, unlocked: false });
  });
});

describe("Show changes (1.2)", () => {
  it("marks removed and added lines against the previous version", () => {
    expect(diffLines(["a", "b", "c", "d"], ["a", "b"])).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
      { type: "removed", text: "c" },
      { type: "removed", text: "d" },
    ]);
    expect(diffLines(["a"], ["a", "new"]).at(-1)).toEqual({ type: "added", text: "new" });
  });

  it("shows a rewritten line as a word-level diff", () => {
    const [change] = diffLines(["We suggest a short call this week."], ["We suggest a short call this week, calmly."]);
    expect(change.type).toBe("rewritten");
    expect(diffWords("a short call", "a calm call")).toEqual([
      { type: "same", text: "a " },
      { type: "removed", text: "short" },
      { type: "added", text: "calm" },
      { type: "same", text: " call" },
    ]);
  });

  it("diffs Chinese text character by character", () => {
    const parts = diffWords("我们建议本周通话", "我们建议今天通话");
    expect(parts.filter((p) => p.type !== "same").map((p) => p.text)).toEqual(["本周", "今天"]);
  });

  it("knows which lines are new, for the brief highlight after an edit", () => {
    expect([...newLines(["a", "b"], ["a", "c", "d"])]).toEqual(["c", "d"]);
  });
});
