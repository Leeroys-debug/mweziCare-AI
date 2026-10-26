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
let clinicianId: string;
let assessmentId: string;
const RULESET_VERSION = 910000 + (Date.now() % 90000);

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
}));
vi.mock("@/lib/server-db", () => ({ db }));

function reviewRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/case-samples/x/review", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!db)("POST /api/v1/case-samples/[id]/review", () => {
  beforeAll(async () => {
    const [clinician] = await db!
      .insert(schema.users)
      .values({
        email: `case-review-clinician-${Date.now()}@example.com`,
        role: "clinician",
      })
      .returning({ id: schema.users.id });
    clinicianId = clinician!.id;

    const [subject] = await db!
      .insert(schema.users)
      .values({ email: `case-review-subject-${Date.now()}@example.com` })
      .returning({ id: schema.users.id });

    await db!
      .insert(schema.rulesets)
      .values({ version: RULESET_VERSION, status: "draft" });

    const [assessment] = await db!
      .insert(schema.assessments)
      .values({
        userId: subject!.id,
        rulesetVersion: RULESET_VERSION,
        outcome: "urgent",
        reasons: [],
      })
      .returning({ id: schema.assessments.id });
    assessmentId = assessment!.id;
  });

  afterAll(async () => {
    await db!
      .delete(schema.assessmentReviews)
      .where(eq(schema.assessmentReviews.assessmentId, assessmentId));
    await db!
      .delete(schema.assessments)
      .where(eq(schema.assessments.id, assessmentId));
    await db!
      .delete(schema.rulesets)
      .where(eq(schema.rulesets.version, RULESET_VERSION));
    await db!.delete(schema.users).where(eq(schema.users.id, clinicianId));
  });

  it("denies non-clinician roles", async () => {
    currentUser = { id: "u-verifier", role: "verifier" };
    const { POST } = await import("./route");
    const response = await POST(reviewRequest({ verdict: "appropriate" }), {
      params: Promise.resolve({ id: assessmentId }),
    });
    expect(response.status).toBe(403);
  });

  it("rejects an invalid verdict", async () => {
    currentUser = { id: clinicianId, role: "clinician" };
    const { POST } = await import("./route");
    const response = await POST(reviewRequest({ verdict: "maybe" }), {
      params: Promise.resolve({ id: assessmentId }),
    });
    expect(response.status).toBe(400);
  });

  it("records the clinician's verdict against the assessment", async () => {
    currentUser = { id: clinicianId, role: "clinician" };
    const { POST } = await import("./route");
    const response = await POST(
      reviewRequest({ verdict: "inappropriate", note: "escalated too early" }),
      { params: Promise.resolve({ id: assessmentId }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.review.assessmentId).toBe(assessmentId);
    expect(body.review.reviewedBy).toBe(clinicianId);
    expect(body.review.verdict).toBe("inappropriate");
  });
});
