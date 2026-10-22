import { generateText } from "ai";
import type { Database, KeyProvider } from "@mwezicare/db";
import type { EmbeddingProvider } from "./kb/embeddings";
import { buildSystemPrompt } from "./prompt";
import {
  persistMessage,
  type PersistMessageInput,
  type PersistMessageResult,
} from "./persist";
import { postFilter, type SafetyChecker } from "./postfilter";
import { retrieve } from "./retrieval";
import type { Classifier } from "./safety/classify";
import {
  loadFixedResponse,
  type SafetyResponseKind,
} from "./safety/fixed-responses";
import { screenForUrgentRedFlags } from "./safety/redflag-screen";
import { containsSelfHarmLanguage } from "./safety/self-harm-keywords";

export interface PipelineDependencies {
  db: Database;
  classifier: Classifier;
  embeddings: EmbeddingProvider;
  safetyChecker: SafetyChecker;
  keyProvider: KeyProvider;
  /** "provider/model" gateway string — see packages/validation's ASSISTANT_CHAT_MODEL. */
  chatModel: string;
  contentRoot?: string;
  /** Dev-only — mirrors kb/ingest.ts's flag so draft KB content is retrievable before review. */
  includeDraftsInRetrieval?: boolean;
  /**
   * Injectable seams for retrieval/generation/persistence — default to the
   * real implementations. Tests substitute these instead of faking a real
   * Postgres connection or a live model call (see src/pipeline.test.ts).
   */
  retrieveFn?: typeof retrieve;
  generateFn?: (args: {
    model: string;
    system: string;
    prompt: string;
  }) => Promise<{ text: string }>;
  persistFn?: (input: PersistMessageInput) => Promise<PersistMessageResult>;
}

export interface PipelineInput {
  userId: string;
  sessionId?: string;
  message: string;
  locale: string;
}

export interface PipelineSource {
  slug: string;
  title: string;
  status?: "draft" | "approved";
}

export interface PipelineOutput {
  sessionId: string;
  /** The persisted assistant message's id — used by the chat UI's thumbs up/down. */
  messageId: string;
  text: string;
  sources: PipelineSource[];
  safetyFlags: Record<string, unknown>;
}

async function respondWithFixed(
  deps: PipelineDependencies,
  input: PipelineInput,
  kind: SafetyResponseKind,
  safetyFlags: Record<string, unknown>,
): Promise<PipelineOutput> {
  const fixed = await loadFixedResponse(kind, input.locale, deps.contentRoot);
  const persist = deps.persistFn ?? persistMessage;

  const { sessionId } = await persist({
    db: deps.db,
    userId: input.userId,
    sessionId: input.sessionId,
    role: "user",
    content: input.message,
    keyProvider: deps.keyProvider,
  });
  const { messageId } = await persist({
    db: deps.db,
    userId: input.userId,
    sessionId,
    role: "assistant",
    content: fixed.body,
    keyProvider: deps.keyProvider,
    safetyFlags,
    sources: [],
  });

  return { sessionId, messageId, text: fixed.body, sources: [], safetyFlags };
}

/**
 * The five-step assistant pipeline (pre-filter, retrieval, generation,
 * post-filter, persist). Pre-filter runs the deterministic keyword/rules-
 * engine screen BEFORE the LLM classifier — so a wrong/unavailable
 * classifier can never let an urgent or self-harm message through (see
 * src/pipeline.test.ts's red-team set, which proves this with a classifier
 * that always says "in_scope").
 *
 * Generation is not streamed internally: the post-filter step must see the
 * complete answer before anything is shown to the user, so this function
 * returns the final, already-safety-checked text; the API route re-chunks
 * it into an SSE stream for the client (see apps/web's chat route doc
 * comment for why).
 */
export async function runAssistantPipeline(
  deps: PipelineDependencies,
  input: PipelineInput,
): Promise<PipelineOutput> {
  const redFlagResult = screenForUrgentRedFlags(input.message);
  if (redFlagResult.outcome === "urgent") {
    return respondWithFixed(deps, input, "urgent", {
      category: "urgent",
      detectedBy: "keyword",
    });
  }
  if (containsSelfHarmLanguage(input.message)) {
    return respondWithFixed(deps, input, "self-harm", {
      category: "self_harm",
      detectedBy: "keyword",
    });
  }

  const classification = await deps.classifier.classify(
    input.message,
    input.locale,
  );
  if (classification === "urgent") {
    return respondWithFixed(deps, input, "urgent", {
      category: "urgent",
      detectedBy: "classifier",
    });
  }
  if (classification === "self_harm") {
    return respondWithFixed(deps, input, "self-harm", {
      category: "self_harm",
      detectedBy: "classifier",
    });
  }
  if (classification === "out_of_scope") {
    return respondWithFixed(deps, input, "out-of-scope", {
      category: "out_of_scope",
    });
  }

  const retrieveImpl = deps.retrieveFn ?? retrieve;
  const generateImpl = deps.generateFn ?? generateText;
  const persist = deps.persistFn ?? persistMessage;

  const [queryEmbedding] = await deps.embeddings.embed([input.message]);
  const sources = await retrieveImpl(deps.db, {
    locale: input.locale,
    queryEmbedding: queryEmbedding!,
    includeDrafts: deps.includeDraftsInRetrieval,
  });

  if (sources.length === 0) {
    return respondWithFixed(deps, input, "no-reliable-information", {
      category: "in_scope",
      retrieval: "below_threshold",
    });
  }

  const systemPrompt = buildSystemPrompt(input.locale, sources);
  const { text: generated } = await generateImpl({
    model: deps.chatModel,
    system: systemPrompt,
    prompt: input.message,
  });

  const filterResult = await postFilter(generated, deps.safetyChecker);
  if (!filterResult.safe) {
    return respondWithFixed(deps, input, "no-reliable-information", {
      category: "in_scope",
      postFilter: filterResult.reason ?? "unsafe",
    });
  }

  const sourceRefs: PipelineSource[] = sources.map((source) => ({
    slug: source.slug,
    title: source.title,
    status: source.status,
  }));
  const safetyFlags = { category: "in_scope" as const };
  const { sessionId } = await persist({
    db: deps.db,
    userId: input.userId,
    sessionId: input.sessionId,
    role: "user",
    content: input.message,
    keyProvider: deps.keyProvider,
  });
  const { messageId } = await persist({
    db: deps.db,
    userId: input.userId,
    sessionId,
    role: "assistant",
    content: generated,
    keyProvider: deps.keyProvider,
    safetyFlags,
    // The DB column is a plain text[] — only slugs are persisted; title/status
    // are re-derived from kb_documents when rendering history if ever needed.
    sources: sourceRefs.map((source) => source.slug),
  });

  return {
    sessionId,
    messageId,
    text: generated,
    sources: sourceRefs,
    safetyFlags,
  };
}
