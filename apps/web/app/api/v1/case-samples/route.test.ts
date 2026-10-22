import { config } from "dotenv";
import { describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "@mwezicare/db";

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

describe.skipIf(!db)("/api/v1/case-samples — role enforcement", () => {
  it("denies 'verifier', 'programme_admin' and 'system_admin'", async () => {
    for (const role of ["verifier", "programme_admin", "system_admin"]) {
      currentUser = { id: `u-${role}`, role };
      const { GET } = await import("./route");
      const response = await GET();
      expect(response.status).toBe(403);
    }
  });

  it("allows 'clinician'", async () => {
    currentUser = { id: "u-clinician", role: "clinician" };
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.samples)).toBe(true);
  });
});
