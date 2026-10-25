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
const testEmail = `staff-users-test-${Date.now()}@example.com`;
let createdUserId: string;

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

describe.skipIf(!db)("/api/v1/staff-users/lookup — role enforcement", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({ email: testEmail })
      .returning({ id: schema.users.id });
    createdUserId = user!.id;
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, createdUserId));
  });

  it("denies 'clinician' and 'programme_admin'", async () => {
    for (const role of ["clinician", "programme_admin"]) {
      currentUser = { id: `u-${role}`, role };
      const { POST } = await import("./route");
      const response = await POST(
        new Request("http://localhost/api/v1/staff-users/lookup", {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
          body: JSON.stringify({ email: testEmail }),
        }),
      );
      expect(response.status).toBe(403);
    }
  });

  it("allows 'system_admin' and returns only support fields, never health data", async () => {
    currentUser = { id: "u-system_admin", role: "system_admin" };
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/staff-users/lookup", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ email: testEmail }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.found).toBe(true);
    expect(body.user.id).toBe(createdUserId);
    expect(body.user).not.toHaveProperty("phoneEnc");
    expect(body.user).not.toHaveProperty("phoneNumber");
  });

  it("reports not found for an unregistered email", async () => {
    currentUser = { id: "u-system_admin", role: "system_admin" };
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/staff-users/lookup", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "unregistered-user@example.com" }),
      }),
    );
    const body = await response.json();
    expect(body.found).toBe(false);
  });
});
