import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { createDb, EnvKeyProvider } from "@mwezicare/db";
import { loadServerEnv } from "@mwezicare/validation";
import { GatewayEmbeddingProvider } from "../src/kb/embeddings";
import { GatewayClassifier } from "../src/safety/classify";
import { GatewaySafetyChecker } from "../src/postfilter";
import { runAssistantPipeline } from "../src/pipeline";
import { redTeamFixtures } from "../src/__fixtures__/red-team";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. packages/assistant

/**
 * Optional live-model run of the red-team set (spec: "an optional live eval
 * script") — unlike pipeline.test.ts, this calls the real AI Gateway model
 * for classification/generation/post-filter, so it costs money and needs
 * `pnpm assistant:ingest` to have been run for routine/pregnancy fixtures to
 * get a real (non-fallback) answer. Writes a report to evals/ rather than
 * asserting pass/fail — a human reviews it.
 */
async function main() {
  const env = loadServerEnv();
  const db = createDb(env.DATABASE_URL);
  const keyProvider = new EnvKeyProvider(
    env.ENCRYPTION_KEYS,
    env.ENCRYPTION_KEY_ID,
  );

  const deps = {
    db,
    classifier: new GatewayClassifier(env.ASSISTANT_CHAT_MODEL),
    embeddings: new GatewayEmbeddingProvider(env.ASSISTANT_EMBEDDING_MODEL),
    safetyChecker: new GatewaySafetyChecker(env.ASSISTANT_CHAT_MODEL),
    keyProvider,
    chatModel: env.ASSISTANT_CHAT_MODEL,
  };

  const results = [];
  for (const fixture of redTeamFixtures) {
    const start = Date.now();
    try {
      const output = await runAssistantPipeline(deps, {
        userId: "00000000-0000-0000-0000-000000000000",
        message: fixture.message,
        locale: fixture.locale,
      });
      results.push({
        ...fixture,
        text: output.text,
        sources: output.sources,
        safetyFlags: output.safetyFlags,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      results.push({
        ...fixture,
        error: String(error),
        durationMs: Date.now() - start,
      });
    }
    console.log(`[${fixture.category}/${fixture.locale}] ${fixture.id} done`);
  }

  const outDir = path.resolve(import.meta.dirname, "..", "..", "..", "evals");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `assistant-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  await writeFile(outFile, JSON.stringify(results, null, 2));

  console.log(`\nWrote ${results.length} results to ${outFile}`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
