import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema, type Database } from "@mwezicare/db";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. apps/web

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

interface FakeUser {
  id: string;
  role: string;
}

let currentUser: FakeUser | null = { id: "u-clinician", role: "clinician" };
let documentId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => currentUser),
  requireApiRole: vi.fn(async (allowedRoles: string[]) => {
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ title: "Forbidden" }), {
          status: 403,
        }),
      };
    }
    return { ok: true, user: currentUser };
  }),
  logAccess: vi.fn(async () => undefined),
}));
vi.mock("@/lib/server-db", () => ({ db }));
vi.mock("@/lib/job-queue", () => ({
  enqueueKbIngest: vi.fn(async () => undefined),
}));

function approveRequest(): Request {
  return new Request("http://localhost/api/v1/kb-documents/x/approve", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  });
}

describe.skipIf(!db)("POST /api/v1/kb-documents/[id]/approve", () => {
  beforeAll(async () => {
    const [doc] = await db!
      .insert(schema.kbDocuments)
      .values({
        locale: "en",
        slug: `approve-tags-test-${Date.now()}`,
        title: "[CLINICAL REVIEW REQUIRED] What is endometriosis?",
        body:
          "[CLINICAL REVIEW REQUIRED] First paragraph.\n\n" +
          "[CLINICAL REVIEW REQUIRED][TRANSLATION REVIEW REQUIRED] Second paragraph.",
        status: "draft",
      })
      .returning({ id: schema.kbDocuments.id });
    documentId = doc!.id;
  });

  afterAll(async () => {
    await db!
      .delete(schema.kbDocuments)
      .where(eq(schema.kbDocuments.id, documentId));
  });

  it("strips [CLINICAL REVIEW REQUIRED]/[TRANSLATION REVIEW REQUIRED] tags from the title and body on approval", async () => {
    currentUser = { id: "u-clinician", role: "clinician" };
    const { POST } = await import("./route");
    const response = await POST(approveRequest(), {
      params: Promise.resolve({ id: documentId }),
    });
    expect(response.status).toBe(200);

    const [updated] = await db!
      .select()
      .from(schema.kbDocuments)
      .where(eq(schema.kbDocuments.id, documentId));

    expect(updated!.status).toBe("approved");
    expect(updated!.title).toBe("What is endometriosis?");
    expect(updated!.body).toBe("First paragraph.\n\nSecond paragraph.");
  });
});
