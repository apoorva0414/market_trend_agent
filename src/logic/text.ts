const CJK = /[㐀-鿿]/;

export function isChinese(text: string): boolean {
  return CJK.test(text);
}

/** Splits after sentence punctuation. Decimals such as "64.5k" stay intact because no space follows the dot. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|(?<=[。！？])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Chinese sentences are joined without spaces. */
export function joinSentences(sentences: string[]): string {
  return sentences.join(sentences.some(isChinese) ? "" : " ");
}
