import { config } from "dotenv";
import { eq, like } from "drizzle-orm";
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

let facilityId: string;

describe.skipIf(!db)("/api/v1/staff-facilities — role enforcement", () => {
  beforeAll(async () => {
    const [facility] = await db!
      .insert(schema.facilities)
      .values({
        kmhflCode: `ROLE-TEST-${Date.now()}`,
        name: "Role Test Facility",
        county: "Kiambu",
      })
      .returning({ id: schema.facilities.id });
    facilityId = facility!.id;
    await db!
      .insert(schema.facilityServices)
      .values({ facilityId, serviceCode: "GYN", status: "listed" });
  });

  afterAll(async () => {
    await db!
      .delete(schema.facilities)
      .where(like(schema.facilities.kmhflCode, "ROLE-TEST-%"));
  });

  it("GET list denies 'clinician'", async () => {
    currentUser = { id: "u-clinician", role: "clinician" };
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/v1/staff-facilities"),
    );
    expect(response.status).toBe(403);
  });

  it("GET list allows 'verifier'", async () => {
    currentUser = { id: "u-verifier", role: "verifier" };
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/v1/staff-facilities"),
    );
    expect(response.status).toBe(200);
  });

  it("verify denies 'programme_admin' (read-only) and allows 'verifier'", async () => {
    currentUser = { id: "u-programme_admin", role: "programme_admin" };
    const { POST } = await import("./[id]/verify/route");
    const denied = await POST(
      new Request(
        `http://localhost/api/v1/staff-facilities/${facilityId}/verify`,
        {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
          body: JSON.stringify({
            status: "verified",
            notes: "Called and confirmed.",
            callScript: {
              phoneConfirmed: true,
              gynAvailable: true,
              daysHours: "Mon-Fri",
              referralNeeded: false,
              costInfo: "",
            },
          }),
        },
      ),
      { params: Promise.resolve({ id: facilityId }) },
    );
    expect(denied.status).toBe(403);

    currentUser = { id: "u-verifier", role: "verifier" };
    const allowed = await POST(
      new Request(
        `http://localhost/api/v1/staff-facilities/${facilityId}/verify`,
        {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
          body: JSON.stringify({
            status: "verified",
            notes: "Called and confirmed.",
            callScript: {
              phoneConfirmed: true,
              gynAvailable: true,
              daysHours: "Mon-Fri",
              referralNeeded: false,
              costInfo: "",
            },
          }),
        },
      ),
      { params: Promise.resolve({ id: facilityId }) },
    );
    expect(allowed.status).toBe(200);

    const [service] = await db!
      .select()
      .from(schema.facilityServices)
      .where(eq(schema.facilityServices.facilityId, facilityId));
    expect(service?.status).toBe("verified");
    expect(service?.notes).toBe("Called and confirmed.");
  });
});
