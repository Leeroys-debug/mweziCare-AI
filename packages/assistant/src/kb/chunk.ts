import type { Chunk } from "./types";

// Rough words-per-token ratio for English/Swahili prose — avoids pulling in
// a real tokenizer dependency just to pick a ~400-token chunk boundary.
const TOKENS_PER_WORD = 1.3;
const TARGET_TOKENS = 400;
const OVERLAP_TOKENS = 50;

const TARGET_WORDS = Math.round(TARGET_TOKENS / TOKENS_PER_WORD);
const OVERLAP_WORDS = Math.round(OVERLAP_TOKENS / TOKENS_PER_WORD);

/**
 * Splits article body text into ~400-token chunks with ~50-token overlap
 * (spec: packages/assistant ingestion). Chunks on word boundaries, not
 * sentences/paragraphs, to keep the overlap math simple and predictable.
 */
export function chunkText(body: string): Chunk[] {
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const step = TARGET_WORDS - OVERLAP_WORDS;
  const chunks: Chunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < words.length) {
    const end = Math.min(start + TARGET_WORDS, words.length);
    chunks.push({ chunkIndex, content: words.slice(start, end).join(" ") });
    chunkIndex += 1;
    if (end >= words.length) break;
    start += step;
  }

  return chunks;
}
