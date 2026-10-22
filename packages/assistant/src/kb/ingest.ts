import { eq } from "drizzle-orm";
import { schema, type Database } from "@mwezicare/db";
import { chunkText } from "./chunk";
import type { EmbeddingProvider } from "./embeddings";
import { defaultContentRoot, loadArticles } from "./load-articles";

export interface IngestOptions {
  /** Defaults to the repo's top-level content/ directory. */
  contentRoot?: string;
  /** Locales to scan — defaults to the two shipped locales. */
  locales?: string[];
  /** Dev-only: also ingest status:"draft" articles (spec: shown with a DRAFT banner in the UI). */
  includeDrafts?: boolean;
}

export interface IngestResult {
  documentsUpserted: number;
  chunksWritten: number;
  skippedDraft: number;
}

/**
 * One-time/idempotent bootstrap: upserts content/{locale}/*.md into
 * clinical.kb_documents by (locale, slug) and replaces each document's
 * clinical.kb_chunks with freshly chunked + embedded content. This is the
 * seed path (packages/assistant's `pnpm ingest` CLI) — once a clinician
 * starts editing an article in the staff knowledge-base console, the
 * DATABASE row is the source of truth, not the file, so re-running this
 * would stomp their edit. Ongoing re-ingestion after an edit/approval goes
 * through reingestDocumentChunks below instead, which only reads the DB.
 * Only status:"approved" articles are ingested unless `includeDrafts` is
 * set (CLAUDE.md: no clinical content ships as final without review).
 */
export async function ingestKnowledgeBase(
  db: Database,
  embeddings: EmbeddingProvider,
  options: IngestOptions = {},
): Promise<IngestResult> {
  const contentRoot = options.contentRoot ?? defaultContentRoot();
  const locales = options.locales ?? ["en", "sw"];

  let documentsUpserted = 0;
  let chunksWritten = 0;
  let skippedDraft = 0;

  for (const locale of locales) {
    const articles = await loadArticles(contentRoot, locale);

    for (const article of articles) {
      if (article.status !== "approved" && !options.includeDrafts) {
        skippedDraft++;
        continue;
      }

      const chunks = chunkText(article.body);
      const vectors =
        chunks.length > 0
          ? await embeddings.embed(chunks.map((c) => c.content))
          : [];

      await db.transaction(async (tx) => {
        const [document] = await tx
          .insert(schema.kbDocuments)
          .values({
            locale: article.locale,
            slug: article.slug,
            title: article.title,
            body: article.body,
            status: article.status,
            reviewDue: article.reviewDue,
          })
          .onConflictDoUpdate({
            target: [schema.kbDocuments.locale, schema.kbDocuments.slug],
            set: {
              title: article.title,
              body: article.body,
              status: article.status,
              reviewDue: article.reviewDue,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.kbDocuments.id });

        await tx
          .delete(schema.kbChunks)
          .where(eq(schema.kbChunks.documentId, document!.id));

        if (chunks.length > 0) {
          await tx.insert(schema.kbChunks).values(
            chunks.map((chunk, i) => ({
              documentId: document!.id,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              embedding: vectors[i]!,
            })),
          );
        }
      });

      documentsUpserted++;
      chunksWritten += chunks.length;
    }
  }

  return { documentsUpserted, chunksWritten, skippedDraft };
}

/**
 * Re-chunks + re-embeds ONE existing clinical.kb_documents row from its
 * current (database) body — used by the staff knowledge-base console's
 * approve/edit actions via the kb.ingest pg-boss job, so an in-DB edit is
 * what gets re-ingested, never the on-disk content/*.md file. Throws if the
 * document doesn't exist.
 */
export async function reingestDocumentChunks(
  db: Database,
  embeddings: EmbeddingProvider,
  documentId: string,
): Promise<{ chunksWritten: number }> {
  const [document] = await db
    .select({ body: schema.kbDocuments.body })
    .from(schema.kbDocuments)
    .where(eq(schema.kbDocuments.id, documentId));
  if (!document) {
    throw new Error(`kb_documents row not found: ${documentId}`);
  }

  const chunks = chunkText(document.body);
  const vectors =
    chunks.length > 0
      ? await embeddings.embed(chunks.map((c) => c.content))
      : [];

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.kbChunks)
      .where(eq(schema.kbChunks.documentId, documentId));
    if (chunks.length > 0) {
      await tx.insert(schema.kbChunks).values(
        chunks.map((chunk, i) => ({
          documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: vectors[i]!,
        })),
      );
    }
  });

  return { chunksWritten: chunks.length };
}
