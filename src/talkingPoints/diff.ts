import { isChinese } from "../logic/text";

export interface DiffPart {
  type: "same" | "added" | "removed";
  text: string;
}

/** Longest-common-subsequence diff over any sequence of strings. */
export function diffSequences(before: string[], after: string[]): DiffPart[] {
  const rows = before.length;
  const cols = after.length;
  const lcs: number[][] = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      parts.push({ type: "same", text: before[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      parts.push({ type: "removed", text: before[i++] });
    } else {
      parts.push({ type: "added", text: after[j++] });
    }
  }
  while (i < rows) parts.push({ type: "removed", text: before[i++] });
  while (j < cols) parts.push({ type: "added", text: after[j++] });
  return parts;
}

/** Words for spaced languages, single characters for Chinese. Whitespace is kept so the text can be rejoined. */
function tokens(text: string): string[] {
  return isChinese(text) ? [...text] : text.split(/(\s+)/).filter((token) => token !== "");
}

/** Word-level diff of one rewritten line, with neighbouring parts of the same type merged. */
export function diffWords(before: string, after: string): DiffPart[] {
  const merged: DiffPart[] = [];
  for (const part of diffSequences(tokens(before), tokens(after))) {
    const last = merged[merged.length - 1];
    if (last && last.type === part.type) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}

export type LineChange =
  | { type: "same" | "added" | "removed"; text: string }
  | { type: "rewritten"; text: string; parts: DiffPart[] };

/**
 * Line-level changes between two versions of a list. A removed line directly followed by an
 * added line is shown as one rewritten line with a word-level diff.
 */
export function diffLines(before: string[], after: string[]): LineChange[] {
  const parts = diffSequences(before, after);
  const changes: LineChange[] = [];
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const next = parts[index + 1];
    if (part.type === "removed" && next?.type === "added") {
      changes.push({ type: "rewritten", text: next.text, parts: diffWords(part.text, next.text) });
      index++;
    } else {
      changes.push(part);
    }
  }
  return changes;
}

/** Lines of `after` that are not in `before`: the ones to highlight briefly after an edit. */
export function newLines(before: string[], after: string[]): Set<string> {
  const known = new Set(before);
  return new Set(after.filter((line) => !known.has(line)));
}
