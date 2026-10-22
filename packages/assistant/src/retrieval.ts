import { sql } from "drizzle-orm";
import type { Database } from "@mwezicare/db";

export interface RetrievedChunk {
  slug: string;
  title: string;
  content: string;
  similarity: number;
  /** "draft" only ever appears here when includeDrafts is set (dev) — the UI shows a DRAFT banner for it. */
  status: "draft" | "approved";
}

export interface RetrieveOptions {
  locale: string;
  queryEmbedding: number[];
  limit?: number;
  /** Cosine similarity below this is treated as "no reliable match" — spec's retrieval threshold. */
  minSimilarity?: number;
  /** Dev-only, mirrors kb/ingest.ts's includeDrafts flag. */
  includeDrafts?: boolean;
}

const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_SIMILARITY = 0.7;

/**
 * Top-N chunks in the user's locale by pgvector cosine similarity
 * (`<=>` is cosine *distance*, so similarity = 1 - distance), restricted to
 * approved content unless includeDrafts is set. Rows below minSimilarity
 * are dropped — an empty result means the pipeline should fall back to the
 * "I don't have reliable information" response rather than cite a weak
 * match.
 */
export async function retrieve(
  db: Database,
  options: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const {
    locale,
    queryEmbedding,
    limit = DEFAULT_LIMIT,
    minSimilarity = DEFAULT_MIN_SIMILARITY,
    includeDrafts = false,
  } = options;

  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const statuses = includeDrafts
    ? sql`('approved', 'draft')`
    : sql`('approved')`;

  const rows = await db.execute<{
    slug: string;
    title: string;
    content: string;
    status: "draft" | "approved";
    similarity: number | string;
  }>(sql`
    select kd.slug, kd.title, kd.status, kc.content,
      1 - (kc.embedding <=> ${vectorLiteral}::vector) as similarity
    from clinical.kb_chunks kc
    join clinical.kb_documents kd on kd.id = kc.document_id
    where kd.locale = ${locale} and kd.status in ${statuses}
    order by kc.embedding <=> ${vectorLiteral}::vector
    limit ${limit}
  `);

  return rows
    .map((row) => ({ ...row, similarity: Number(row.similarity) }))
    .filter((row) => row.similarity >= minSimilarity);
}
