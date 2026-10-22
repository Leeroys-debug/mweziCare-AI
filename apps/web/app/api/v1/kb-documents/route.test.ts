import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
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

let currentUser: FakeUser | null = null;

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

let documentId: string;

describe.skipIf(!db)("/api/v1/kb-documents — role enforcement", () => {
  afterAll(async () => {
    if (documentId)
      await db!
        .delete(schema.kbDocuments)
        .where(eq(schema.kbDocuments.id, documentId));
  });

  it("GET denies 'verifier' and 'user'", async () => {
    for (const role of ["verifier", "user"]) {
      currentUser = { id: `u-${role}`, role };
      const { GET } = await import("./route");
      const response = await GET();
      expect(response.status).toBe(403);
    }
  });

  it("GET allows 'clinician'", async () => {
    currentUser = { id: "u-clinician", role: "clinician" };
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("PUT on a specific article denies 'programme_admin' (read-only)", async () => {
    const [created] = await db!
      .insert(schema.kbDocuments)
      .values({
        locale: "en",
        slug: `role-test-${Date.now()}`,
        title: "Role test article",
        body: "Body.",
      })
      .returning({ id: schema.kbDocuments.id });
    documentId = created!.id;

    currentUser = { id: "u-programme_admin", role: "programme_admin" };
    const { PUT } = await import("./[id]/route");
    const response = await PUT(
      new Request(`http://localhost/api/v1/kb-documents/${documentId}`, {
        method: "PUT",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({
          title: "Edited",
          body: "Edited body.",
          reviewDue: null,
        }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    expect(response.status).toBe(403);
  });

  it("PUT and approve succeed for 'clinician'", async () => {
    currentUser = { id: "u-clinician", role: "clinician" };
    const { PUT } = await import("./[id]/route");
    const putResponse = await PUT(
      new Request(`http://localhost/api/v1/kb-documents/${documentId}`, {
        method: "PUT",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({
          title: "Edited",
          body: "Edited body.",
          reviewDue: null,
        }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    expect(putResponse.status).toBe(200);

    const { POST: approve } = await import("./[id]/approve/route");
    const approveResponse = await approve(
      new Request("http://localhost/approve", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
      {
        params: Promise.resolve({ id: documentId }),
      },
    );
    expect(approveResponse.status).toBe(200);

    const [row] = await db!
      .select()
      .from(schema.kbDocuments)
      .where(eq(schema.kbDocuments.id, documentId));
    expect(row?.status).toBe("approved");
  });
});
