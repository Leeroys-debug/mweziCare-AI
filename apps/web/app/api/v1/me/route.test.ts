import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema, type Database } from "@mwezicare/db";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

let userId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: userId })),
}));
vi.mock("@/lib/server-db", () => ({ db }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      signOut: vi.fn(async () => ({
        success: true,
        url: undefined,
        redirect: false,
      })),
    },
  },
}));

function sameOriginRequest(): Request {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new Request(`${origin}/api/v1/me`, {
    method: "DELETE",
    headers: { origin },
  });
}

describe.skipIf(!db)("DELETE /api/v1/me", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        email: `me-delete-test-${Date.now()}@example.com`,
      })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("marks the account for deletion and signs out instead of deleting immediately", async () => {
    const { DELETE } = await import("./route");
    const response = await DELETE(sameOriginRequest());
    expect(response.status).toBe(200);

    const [row] = await db!
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(row).toBeDefined();
    expect(row?.deletionRequestedAt).toBeInstanceOf(Date);

    const { auth } = await import("@/lib/auth");
    expect(auth.api.signOut).toHaveBeenCalled();

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("better-auth.session_token=");
  });
});
