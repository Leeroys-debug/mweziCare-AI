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

// requireApiRole lives in @/lib/rbac alongside getCurrentUser — mocking the
// whole module (rather than spreading importOriginal) is necessary because
// requireApiRole's real implementation closes over the module's own
// getCurrentUser binding, which a partial override wouldn't reach. This
// re-implements the same trivial role-membership check against a
// test-controlled `currentUser`.
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

const createdRulesetIds: string[] = [];

describe.skipIf(!db)("/api/v1/rulesets — role enforcement", () => {
  afterAll(async () => {
    for (const id of createdRulesetIds) {
      await db!.delete(schema.rulesets).where(eq(schema.rulesets.id, id));
    }
  });

  it("GET denies a 'user' role", async () => {
    currentUser = { id: "u1", role: "user" };
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("GET allows 'clinician', 'programme_admin' and 'system_admin'", async () => {
    for (const role of ["clinician", "programme_admin", "system_admin"]) {
      currentUser = { id: `u-${role}`, role };
      const { GET } = await import("./route");
      const response = await GET();
      expect(response.status).toBe(200);
    }
  });

  it("POST denies 'programme_admin' (read-only for rulesets) and 'verifier'", async () => {
    for (const role of ["programme_admin", "verifier"]) {
      currentUser = { id: `u-${role}`, role };
      const { POST } = await import("./route");
      const response = await POST(
        new Request("http://localhost/api/v1/rulesets", {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
          body: JSON.stringify({
            rules: [
              {
                id: "test_rule",
                version: 1,
                priority: 0,
                outcome: "routine",
                conditions: { all: [] },
                reason: { en: "test", sw: "test" },
                clinicianNote: "test",
              },
            ],
          }),
        }),
      );
      expect(response.status).toBe(403);
    }
  });

  it("POST allows 'clinician' to create a draft ruleset", async () => {
    currentUser = { id: "u-clinician", role: "clinician" };
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/rulesets", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({
          rules: [
            {
              id: "role_test_rule",
              version: 1,
              priority: 0,
              outcome: "routine",
              conditions: { all: [] },
              reason: { en: "test", sw: "test" },
              clinicianNote: "test",
            },
          ],
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    createdRulesetIds.push(body.ruleset.id);
  });
});
