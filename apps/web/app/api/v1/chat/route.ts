import { and, asc, eq } from "drizzle-orm";
import {
  GatewayClassifier,
  GatewaySafetyChecker,
  clearSession,
  createEmbeddingProvider,
  runAssistantPipeline,
} from "@mwezicare/assistant";
import {
  consumeRateLimitToken,
  decryptField,
  schema,
  track,
  withUser,
} from "@mwezicare/db";
import { chatMessageSchema } from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { problem } from "@/lib/problem-details";
import { getCurrentUser } from "@/lib/rbac";
import {
  analyticsKeyProvider,
  db,
  encryptionKeyProvider,
} from "@/lib/server-db";

const encoder = new TextEncoder();
const SSE_CHUNK_WORD_COUNT = 6;
// 20 messages/hour — generous for genuine use, cheap defense against abuse.
const RATE_LIMIT_CAPACITY = 20;
const RATE_LIMIT_REFILL_PER_SECOND = 20 / 3600;

function sseEvent(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/** Decrypted chat history for a session — for the chat UI to render on load. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return Response.json({ messages: [] });

  const rows = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.chatMessages)
      .where(
        and(
          eq(schema.chatMessages.sessionId, sessionId),
          eq(schema.chatMessages.userId, user.id),
        ),
      )
      .orderBy(asc(schema.chatMessages.createdAt)),
  );

  const messages = rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: decryptField(row.contentEnc, encryptionKeyProvider),
    sources: row.sources ?? [],
    safetyFlags: row.safetyFlags ?? {},
    createdAt: row.createdAt,
  }));

  return Response.json({ messages });
}

/**
 * Runs the full 5-step assistant pipeline (packages/assistant) and streams
 * the ALREADY safety-checked answer to the client as Server-Sent Events.
 * Generation itself isn't streamed live from the model — the post-filter
 * step needs the complete answer first (see packages/assistant/src/
 * pipeline.ts's doc comment) — so this re-chunks the final text into a few
 * "token" events purely so the UI still renders progressively.
 */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const body = await request.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid chat message", parsed.error.message);

  const limit = await consumeRateLimitToken(
    db,
    `chat:${user.id}`,
    RATE_LIMIT_CAPACITY,
    RATE_LIMIT_REFILL_PER_SECOND,
  );
  if (!limit.allowed)
    return problem(
      429,
      "Too many messages — please wait a moment and try again",
    );

  const env = serverEnv();
  const locale = user.locale ?? "en";

  const deps = {
    db,
    classifier: new GatewayClassifier(env.ASSISTANT_CHAT_MODEL),
    embeddings: createEmbeddingProvider({
      googleApiKeyConfigured: !!env.GOOGLE_GENERATIVE_AI_API_KEY,
      gatewayModel: env.ASSISTANT_EMBEDDING_MODEL,
    }),
    safetyChecker: new GatewaySafetyChecker(env.ASSISTANT_CHAT_MODEL),
    keyProvider: encryptionKeyProvider,
    chatModel: env.ASSISTANT_CHAT_MODEL,
    includeDraftsInRetrieval: env.ASSISTANT_INCLUDE_DRAFTS,
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runAssistantPipeline(deps, {
          userId: user.id,
          sessionId: parsed.data.sessionId,
          message: parsed.data.message,
          locale,
        });

        await track(db, {
          userId: user.id,
          eventType: "chat_message",
          props: { inScope: result.safetyFlags.category === "in_scope" },
          analyticsKeyProvider,
        });

        const words = result.text.split(" ");
        for (let i = 0; i < words.length; i += SSE_CHUNK_WORD_COUNT) {
          controller.enqueue(
            sseEvent({
              type: "token",
              value: words.slice(i, i + SSE_CHUNK_WORD_COUNT).join(" ") + " ",
            }),
          );
        }
        controller.enqueue(
          sseEvent({
            type: "done",
            sessionId: result.sessionId,
            messageId: result.messageId,
            sources: result.sources,
            safetyFlags: result.safetyFlags,
          }),
        );
      } catch (error) {
        logger.error({ err: error, userId: user.id }, "chat pipeline failed");
        controller.enqueue(
          sseEvent({
            type: "error",
            message: "Something went wrong. Please try again.",
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** "Clear history" — deletes the session and (cascade) its messages. */
export async function DELETE(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return problem(400, "sessionId query param is required");

  await clearSession(db, user.id, sessionId);
  return new Response(null, { status: 204 });
}
