import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const chunks = chunkText("A short article body about periods.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
  });

  it("returns an empty array for empty text", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("splits long text into overlapping chunks with increasing indices", () => {
    const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
    const chunks = chunkText(words.join(" "));
    const wordIndex = (w: string) => Number(w.replace("word", ""));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));

    // Each chunk after the first starts before the previous chunk ended —
    // i.e. there's a genuine overlapping region, not just adjacency.
    for (let i = 1; i < chunks.length; i++) {
      const prevWords = chunks[i - 1]!.content.split(" ");
      const prevLastIndex = wordIndex(prevWords[prevWords.length - 1]!);
      const currFirstIndex = wordIndex(chunks[i]!.content.split(" ")[0]!);
      expect(currFirstIndex).toBeLessThan(prevLastIndex);
    }
  });

  it("covers every word in the source text across all chunks", () => {
    const words = Array.from({ length: 500 }, (_, i) => `w${i}`);
    const chunks = chunkText(words.join(" "));
    const covered = new Set(chunks.flatMap((c) => c.content.split(" ")));
    for (const word of words) {
      expect(covered.has(word)).toBe(true);
    }
  });
});
