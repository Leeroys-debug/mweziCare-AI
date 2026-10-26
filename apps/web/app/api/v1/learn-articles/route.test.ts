import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema, type Database } from "@mwezicare/db";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. apps/web

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

let currentUser: { id: string } | null = null;
let userId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => currentUser),
}));
vi.mock("@/lib/server-db", () => ({ db }));

const SLUG_PREFIX = `learn-articles-test-${Date.now()}`;
const documentIds: string[] = [];

describe.skipIf(!db)("GET /api/v1/learn-articles", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({ email: `${SLUG_PREFIX}@example.com` })
      .returning({ id: schema.users.id });
    userId = user!.id;

    const rows = await db!
      .insert(schema.kbDocuments)
      .values([
        {
          locale: "en",
          slug: `${SLUG_PREFIX}-approved-en`,
          title: "Approved English article",
          body: "body",
          status: "approved",
        },
        {
          locale: "en",
          slug: `${SLUG_PREFIX}-draft-en`,
          title: "Draft English article",
          body: "body",
          status: "draft",
        },
        {
          locale: "sw",
          slug: `${SLUG_PREFIX}-approved-sw`,
          title: "Makala ya Kiswahili",
          body: "mwili",
          status: "approved",
        },
      ])
      .returning({ id: schema.kbDocuments.id });
    documentIds.push(...rows.map((r) => r.id));
  });

  afterAll(async () => {
    await db!
      .delete(schema.kbDocuments)
      .where(inArray(schema.kbDocuments.id, documentIds));
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("requires sign-in", async () => {
    currentUser = null;
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/v1/learn-articles"),
    );
    expect(response.status).toBe(401);
  });

  it("returns only approved articles in the requested locale", async () => {
    currentUser = { id: userId };
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/v1/learn-articles?locale=en"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const titles = body.articles.map((a: { title: string }) => a.title);
    expect(titles).toContain("Approved English article");
    expect(titles).not.toContain("Draft English article");
    expect(titles).not.toContain("Makala ya Kiswahili");
  });

  it("filters by the sw locale", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/v1/learn-articles?locale=sw"),
    );
    const body = await response.json();
    const titles = body.articles.map((a: { title: string }) => a.title);
    expect(titles).toContain("Makala ya Kiswahili");
    expect(titles).not.toContain("Approved English article");
  });
});
