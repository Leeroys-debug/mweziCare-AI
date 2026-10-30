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

let currentUser: FakeUser | null = null;
const testEmail = `staff-users-role-test-${Date.now()}@example.com`;
let targetUserId: string;

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

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/staff-users/x/role", {
    method: "PATCH",
    headers: {
      origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!db)("PATCH /api/v1/staff-users/[id]/role", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({ email: testEmail })
      .returning({ id: schema.users.id });
    targetUserId = user!.id;
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, targetUserId));
  });

  it("denies 'clinician' and 'programme_admin'", async () => {
    for (const role of ["clinician", "programme_admin"]) {
      currentUser = { id: `u-${role}`, role };
      const { PATCH } = await import("./route");
      const response = await PATCH(patchRequest({ role: "clinician" }), {
        params: Promise.resolve({ id: targetUserId }),
      });
      expect(response.status).toBe(403);
    }
  });

  it("allows 'system_admin' to grant the clinician role, and audits it", async () => {
    currentUser = { id: "u-system_admin", role: "system_admin" };
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ role: "clinician" }), {
      params: Promise.resolve({ id: targetUserId }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.role).toBe("clinician");

    const { logAccess } = await import("@/lib/rbac");
    expect(logAccess).toHaveBeenCalledWith(
      "u-system_admin",
      "user_role_update",
      "user",
      targetUserId,
    );

    const [row] = await db!
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId));
    expect(row!.role).toBe("clinician");
  });

  it("rejects an invalid role value", async () => {
    currentUser = { id: "u-system_admin", role: "system_admin" };
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ role: "superadmin" }), {
      params: Promise.resolve({ id: targetUserId }),
    });
    expect(response.status).toBe(400);
  });

  it("refuses to change your own role", async () => {
    currentUser = { id: "u-system_admin", role: "system_admin" };
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ role: "user" }), {
      params: Promise.resolve({ id: "u-system_admin" }),
    });
    expect(response.status).toBe(400);
  });

  it("404s for a user id that doesn't exist", async () => {
    currentUser = { id: "u-system_admin", role: "system_admin" };
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ role: "user" }), {
      params: Promise.resolve({
        id: "00000000-0000-4000-8000-000000000000",
      }),
    });
    expect(response.status).toBe(404);
  });
});
