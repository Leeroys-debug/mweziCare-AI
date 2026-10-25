import { createDb } from "@mwezicare/db";
import {
  createEmbeddingProvider,
  reingestDocumentChunks,
} from "@mwezicare/assistant";
import { loadServerEnv } from "@mwezicare/validation";

export const JOB_KB_INGEST = "kb.ingest";

export interface KbIngestJobData {
  documentId: string;
}

/**
 * Re-chunks + re-embeds one clinical.kb_documents row — triggered on-demand
 * (not scheduled) whenever a clinician approves or edits a knowledge-base
 * article in the staff console (see apps/web/lib/job-queue.ts's
 * enqueueKbIngest, called from (staff)/knowledge-base's approve/save
 * actions). Reads the article's CURRENT body from the database, never from
 * content/*.md — see packages/assistant's reingestDocumentChunks doc
 * comment for why.
 */
export async function runKbIngest(data: KbIngestJobData): Promise<void> {
  const env = loadServerEnv();
  const db = createDb(env.DATABASE_URL);
  const embeddings = createEmbeddingProvider({
    googleApiKeyConfigured: !!env.GOOGLE_GENERATIVE_AI_API_KEY,
    gatewayModel: env.ASSISTANT_EMBEDDING_MODEL,
  });

  const result = await reingestDocumentChunks(db, embeddings, data.documentId);
  console.log(
    `kb.ingest: document ${data.documentId} — ${result.chunksWritten} chunks written.`,
  );
}
