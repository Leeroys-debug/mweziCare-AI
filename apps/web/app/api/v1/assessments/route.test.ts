import { config } from "dotenv";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createDb,
  EnvKeyProvider,
  schema,
  withUser,
  type Database,
} from "@mwezicare/db";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;
const analyticsKeyProvider = process.env.ANALYTICS_KEY
  ? new EnvKeyProvider(process.env.ANALYTICS_KEY)
  : undefined;

let userId: string;

function sameOriginRequest(): Request {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new Request(`${origin}/api/v1/assessments`, {
    method: "POST",
    headers: { origin },
  });
}

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: userId })),
}));
vi.mock("@/lib/server-db", () => ({ db, analyticsKeyProvider }));

describe.skipIf(!db)("POST & GET /api/v1/assessments", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        phoneNumber: `assessments-test-${Date.now()}`,
        email: `assessments-test-${Date.now()}@phone.mwezicare.invalid`,
      })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  afterEach(async () => {
    // Clean up the approved ruleset this test inserted (and anything that
    // referenced it) so other tests aren't left with a stray approved
    // ruleset. The clinical/0006 trigger only allows an approved ruleset to
    // transition to 'retired' (not be deleted outright), so retire it first.
    await db!
      .update(schema.rulesets)
      .set({ status: "retired" })
      .where(eq(schema.rulesets.version, 999));
    await db!
      .delete(schema.assessments)
      .where(eq(schema.assessments.rulesetVersion, 999));
    await db!.delete(schema.rulesets).where(eq(schema.rulesets.version, 999));
  });

  it("reports unavailable when no ruleset has been approved yet", async () => {
    const { POST } = await import("./route");
    const response = await POST(sameOriginRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ available: false });
  });

  it("GET also reports unavailable when nothing has ever been computed", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();
    expect(body).toEqual({ available: false });
  });

  it("evaluates against an approved ruleset, stores an immutable row, and returns it", async () => {
    // Draft first, then approve — the clinical/0006 trigger rejects
    // inserting rules under an already-approved ruleset (CLAUDE.md
    // "approved versions are immutable").
    const [ruleset] = await db!
      .insert(schema.rulesets)
      .values({ version: 999, status: "draft" })
      .returning({ id: schema.rulesets.id });
    await db!.insert(schema.rules).values({
      rulesetId: ruleset!.id,
      code: "test_urgent_fainting",
      priority: 100,
      outcome: "urgent",
      definition: { feature: "fainting", operator: "eq", value: true },
      reasonEn: "test reason en",
      reasonSw: "test reason sw",
      clinicianNote: "test",
      sortOrder: 0,
    });
    await db!
      .update(schema.rulesets)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(schema.rulesets.id, ruleset!.id));

    await withUser(db!, userId, (tx) =>
      tx.insert(schema.symptomLogs).values({
        userId,
        logDate: "2026-03-01",
        painScore: 2,
        redFlags: {
          suddenSeverePain: false,
          fainting: true,
          possiblePregnancySuspected: false,
        },
        clientId: "assessment-test-log",
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(sameOriginRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.assessment.outcome).toBe("urgent");
    expect(body.assessment.rulesetVersion).toBe(999);
    expect(body.assessment.reasons).toEqual([
      { en: "test reason en", sw: "test reason sw" },
    ]);

    const { GET } = await import("./route");
    const getResponse = await GET();
    const getBody = await getResponse.json();
    expect(getBody.available).toBe(true);
    expect(getBody.assessment.id).toBe(body.assessment.id);
  });
});
