import { eq } from "drizzle-orm";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { schema, type Database } from "@mwezicare/db";
import {
  startTestDatabase,
  type TestDatabase,
} from "@mwezicare/db/testcontainers-setup";
import { retrieve } from "./retrieval";

const CONTAINER_TIMEOUT_MS = 180_000;
const DIMENSIONS = 1536;

/** A unit vector with every weight on one axis — exact cosine similarity between two such vectors is trivial to reason about. */
function axisVector(axis: number): number[] {
  const vector = new Array(DIMENSIONS).fill(0);
  vector[axis] = 1;
  return vector;
}

/**
 * Seeds an approved article's chunk at a known embedding and a draft
 * article's chunk at the same embedding, then asserts retrieve()'s
 * similarity-threshold and approved-only filtering — against a database
 * this test builds and migrates itself, not the dev docker-compose stack.
 */
describe("retrieve (testcontainers)", () => {
  let testDb: TestDatabase;
  let db: Database;

  beforeAll(async () => {
    testDb = await startTestDatabase();
    db = testDb.db;

    const [approvedDoc] = await db
      .insert(schema.kbDocuments)
      .values({
        locale: "en",
        slug: "testcontainers-retrieval-approved",
        title: "Approved article",
        body: "Approved body.",
        status: "approved",
      })
      .returning({ id: schema.kbDocuments.id });
    await db.insert(schema.kbChunks).values({
      documentId: approvedDoc!.id,
      chunkIndex: 0,
      content: "Approved chunk content, close to the query vector.",
      embedding: axisVector(0),
    });

    const [draftDoc] = await db
      .insert(schema.kbDocuments)
      .values({
        locale: "en",
        slug: "testcontainers-retrieval-draft",
        title: "Draft article",
        body: "Draft body.",
        status: "draft",
      })
      .returning({ id: schema.kbDocuments.id });
    await db.insert(schema.kbChunks).values({
      documentId: draftDoc!.id,
      chunkIndex: 0,
      content: "Draft chunk content, same embedding as the approved one.",
      embedding: axisVector(0),
    });

    // Far from the query vector (orthogonal) — cosine similarity 0, below
    // any reasonable threshold.
    const [farDoc] = await db
      .insert(schema.kbDocuments)
      .values({
        locale: "en",
        slug: "testcontainers-retrieval-far",
        title: "Unrelated article",
        body: "Unrelated body.",
        status: "approved",
      })
      .returning({ id: schema.kbDocuments.id });
    await db.insert(schema.kbChunks).values({
      documentId: farDoc!.id,
      chunkIndex: 0,
      content: "Unrelated chunk content, orthogonal to the query vector.",
      embedding: axisVector(1),
    });
  }, CONTAINER_TIMEOUT_MS);

  afterAll(async () => {
    if (db) {
      for (const slug of [
        "testcontainers-retrieval-approved",
        "testcontainers-retrieval-draft",
        "testcontainers-retrieval-far",
      ]) {
        await db
          .delete(schema.kbDocuments)
          .where(eq(schema.kbDocuments.slug, slug));
      }
    }
    await testDb?.stop();
  }, CONTAINER_TIMEOUT_MS);

  it("returns the approved chunk whose embedding matches the query, excluding drafts and far matches", async () => {
    const results = await retrieve(db, {
      locale: "en",
      queryEmbedding: axisVector(0),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("testcontainers-retrieval-approved");
    expect(results[0]?.similarity).toBeCloseTo(1, 5);
  });

  it("includes the draft chunk only when includeDrafts is set", async () => {
    const results = await retrieve(db, {
      locale: "en",
      queryEmbedding: axisVector(0),
      includeDrafts: true,
    });

    const slugs = results.map((r) => r.slug);
    expect(slugs).toContain("testcontainers-retrieval-approved");
    expect(slugs).toContain("testcontainers-retrieval-draft");
  });

  it("drops matches below minSimilarity", async () => {
    const results = await retrieve(db, {
      locale: "en",
      queryEmbedding: axisVector(1),
      minSimilarity: 0.9,
    });

    // axisVector(1) is an exact match for the "far" chunk's own embedding,
    // so it passes threshold on its own axis, but the "approved" chunk
    // (orthogonal to this query) must not appear.
    const slugs = results.map((r) => r.slug);
    expect(slugs).not.toContain("testcontainers-retrieval-approved");
  });
});
