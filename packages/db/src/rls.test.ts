import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, withStaffReview, withUser, type Database } from "./client";
import * as schema from "./schema";

config({ path: "../../.env" });

// Integration test against the real local Postgres (packages/db requires
// one for `pnpm db:migrate`/`pnpm db:seed` anyway — see docker-compose.yml
// at the repo root). Skips instead of failing when no DB is reachable, so
// `pnpm test` still passes in environments without Docker.
const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

describe.skipIf(!db)("row-level security on health.symptom_logs", () => {
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const database = db!;
    const [userA, userB] = await database
      .insert(schema.users)
      .values([
        {
          phoneNumber: `rls-test-a-${Date.now()}`,
          email: `rls-test-a-${Date.now()}@phone.mwezicare.invalid`,
        },
        {
          phoneNumber: `rls-test-b-${Date.now()}`,
          email: `rls-test-b-${Date.now()}@phone.mwezicare.invalid`,
        },
      ])
      .returning({ id: schema.users.id });
    userAId = userA!.id;
    userBId = userB!.id;

    await withUser(database, userAId, (tx) =>
      tx.insert(schema.symptomLogs).values({
        userId: userAId,
        logDate: "2026-01-01",
        painScore: 7,
        clientId: "rls-test-a-log",
      }),
    );
  });

  afterAll(async () => {
    const database = db!;
    await database.delete(schema.users).where(eq(schema.users.id, userAId));
    await database.delete(schema.users).where(eq(schema.users.id, userBId));
  });

  it("lets user A read their own log", async () => {
    const database = db!;
    const rows = await withUser(database, userAId, (tx) =>
      tx
        .select()
        .from(schema.symptomLogs)
        .where(eq(schema.symptomLogs.userId, userAId)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.painScore).toBe(7);
  });

  it("hides user A's log from user B, even when queried without a filter", async () => {
    const database = db!;
    const rows = await withUser(database, userBId, (tx) =>
      tx.select().from(schema.symptomLogs),
    );
    expect(rows).toHaveLength(0);
  });

  it("prevents user B from inserting a log under user A's id", async () => {
    const database = db!;
    await expect(
      withUser(database, userBId, (tx) =>
        tx.insert(schema.symptomLogs).values({
          userId: userAId,
          logDate: "2026-01-02",
          clientId: "rls-test-b-forged",
        }),
      ),
    ).rejects.toThrow();
  });
});

describe.skipIf(!db)(
  "row-level security on health.assessments (staff review bypass)",
  () => {
    let userAId: string;
    let userBId: string;
    let rulesetId: string;

    beforeAll(async () => {
      const database = db!;
      const [userA, userB] = await database
        .insert(schema.users)
        .values([
          {
            phoneNumber: `rls-assess-a-${Date.now()}`,
            email: `rls-assess-a-${Date.now()}@phone.mwezicare.invalid`,
          },
          {
            phoneNumber: `rls-assess-b-${Date.now()}`,
            email: `rls-assess-b-${Date.now()}@phone.mwezicare.invalid`,
          },
        ])
        .returning({ id: schema.users.id });
      userAId = userA!.id;
      userBId = userB!.id;

      const [ruleset] = await database
        .insert(schema.rulesets)
        .values({ version: 998, status: "draft" })
        .returning({ id: schema.rulesets.id });
      rulesetId = ruleset!.id;

      await withUser(database, userAId, (tx) =>
        tx.insert(schema.assessments).values({
          userId: userAId,
          rulesetVersion: 998,
          outcome: "routine",
          reasons: [],
        }),
      );
    });

    afterAll(async () => {
      const database = db!;
      await database
        .delete(schema.assessments)
        .where(eq(schema.assessments.rulesetVersion, 998));
      await database
        .delete(schema.rulesets)
        .where(eq(schema.rulesets.id, rulesetId));
      await database.delete(schema.users).where(eq(schema.users.id, userAId));
      await database.delete(schema.users).where(eq(schema.users.id, userBId));
    });

    it("hides user A's assessment from user B via withUser, same as any other health table", async () => {
      const rows = await withUser(db!, userBId, (tx) =>
        tx.select().from(schema.assessments),
      );
      expect(rows).toHaveLength(0);
    });

    it("withStaffReview sees assessments across every user, not just one", async () => {
      const rows = await withStaffReview(db!, (tx) =>
        tx
          .select()
          .from(schema.assessments)
          .where(eq(schema.assessments.rulesetVersion, 998)),
      );
      expect(rows.some((r) => r.userId === userAId)).toBe(true);
    });
  },
);
