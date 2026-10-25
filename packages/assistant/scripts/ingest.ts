import { config } from "dotenv";
import { createDb } from "@mwezicare/db";
import { loadServerEnv } from "@mwezicare/validation";
import { createEmbeddingProvider } from "../src/kb/embeddings";
import { ingestKnowledgeBase } from "../src/kb/ingest";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. packages/assistant

async function main() {
  const env = loadServerEnv();
  const db = createDb(env.DATABASE_URL);
  const embeddings = createEmbeddingProvider({
    googleApiKeyConfigured: !!env.GOOGLE_GENERATIVE_AI_API_KEY,
    gatewayModel: env.ASSISTANT_EMBEDDING_MODEL,
  });

  const includeDrafts = process.env.ASSISTANT_INCLUDE_DRAFTS === "1";
  const result = await ingestKnowledgeBase(db, embeddings, { includeDrafts });

  console.log(
    `KB ingest: ${result.documentsUpserted} documents, ${result.chunksWritten} chunks` +
      (includeDrafts
        ? ""
        : ` (${result.skippedDraft} draft articles skipped — set ASSISTANT_INCLUDE_DRAFTS=1 to include them)`),
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
