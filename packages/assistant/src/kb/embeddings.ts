import { google } from "@ai-sdk/google";
import { embedMany } from "ai";

/**
 * pgvector column (packages/db/src/schema/clinical.ts) is a fixed
 * `vector(1536)` — every provider must emit exactly this many dimensions,
 * so query-time and ingest-time embeddings always land in the same space.
 */
const VECTOR_DIMENSIONS = 1536;

/**
 * Provider-agnostic embeddings interface (spec: "embed via a
 * provider-agnostic embeddings interface") — swapping the underlying model
 * or provider never touches ingest.ts or retrieval.ts, only this file (or
 * the ASSISTANT_EMBEDDING_MODEL env var, for the gateway implementation).
 */
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export class GatewayEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly model: string) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const { embeddings } = await embedMany({
      model: this.model,
      values: texts,
    });
    return embeddings;
  }
}

/**
 * Calls Google's Generative AI API directly (not through AI Gateway) —
 * Gateway has no free-tier embedding model at all (every one is paid, even
 * the cheapest), so a team without purchased Gateway credits can't run
 * retrieval through it. gemini-embedding-001's free tier covers this
 * comfortably for local dev. Reads GOOGLE_GENERATIVE_AI_API_KEY itself
 * (the `google` provider's default), not a constructor param.
 */
export class GoogleEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const { embeddings } = await embedMany({
      model: google.embedding("gemini-embedding-001"),
      values: texts,
      providerOptions: {
        google: { outputDimensionality: VECTOR_DIMENSIONS },
      },
    });
    return embeddings;
  }
}

/**
 * Deterministic, dependency-free embedding for tests — maps each text to a
 * fixed-length vector from a seeded hash of its words, so semantically
 * similar fixture strings (sharing words) land closer together without a
 * real model call.
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dimensions = 1536) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash * 31 + word.charCodeAt(i)) | 0;
      }
      const index = Math.abs(hash) % this.dimensions;
      vector[index]! += 1;
    }
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / magnitude);
  }
}

/**
 * Picks Google over Gateway whenever a Google key is configured — every
 * call site (chat/route.ts, worker/jobs/kb-ingest.ts, scripts/ingest.ts)
 * goes through this so they can never disagree about which provider (and
 * therefore which vector space) is current.
 */
export function createEmbeddingProvider(options: {
  googleApiKeyConfigured: boolean;
  gatewayModel: string;
}): EmbeddingProvider {
  return options.googleApiKeyConfigured
    ? new GoogleEmbeddingProvider()
    : new GatewayEmbeddingProvider(options.gatewayModel);
}
