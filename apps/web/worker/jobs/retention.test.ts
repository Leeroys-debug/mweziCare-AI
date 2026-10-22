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
import { createDb, schema, type Database } from "@mwezicare/db";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

vi.mock("@/lib/object-storage", () => ({
  deleteObject: vi.fn(async () => undefined),
}));

const {
  purgeOldChatMessages,
  purgeExpiredShareLinks,
  purgeDeletedAccounts,
  pruneAuditLog,
} = await import("./retention");
const { deleteObject } = await import("@/lib/object-storage");

const NOW = new Date("2026-06-01T00:00:00.000Z");
const userIds: string[] = [];

async function makeUser(suffix: string) {
  const [user] = await db!
    .insert(schema.users)
    .values({
      phoneNumber: `retention-test-${suffix}-${Date.now()}`,
      email: `retention-test-${suffix}-${Date.now()}@phone.mwezicare.invalid`,
    })
    .returning({ id: schema.users.id });
  userIds.push(user!.id);
  return user!.id;
}

function daysBefore(reference: Date, days: number): Date {
  return new Date(reference.getTime() - days * 24 * 60 * 60 * 1000);
}

describe.skipIf(!db)("retention job", () => {
  beforeAll(() => {
    // Only fake Date — faking setTimeout/setInterval too breaks postgres-js's
    // own internal connection timers, hanging every query indefinitely.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterAll(async () => {
    vi.useRealTimers();
    // Deleting an id a test already purged (e.g. purgeDeletedAccounts' own
    // assertions) is a harmless no-op — cascades clean up everything else
    // (sessions, summaries, chat messages/sessions, access_log) per user.
    for (const id of userIds) {
      await db!.delete(schema.users).where(eq(schema.users.id, id));
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("purgeOldChatMessages deletes only messages older than the retention window", async () => {
    const userId = await makeUser("chat");
    const [session] = await db!
      .insert(schema.chatSessions)
      .values({ userId })
      .returning({ id: schema.chatSessions.id });

    const [oldMsg] = await db!
      .insert(schema.chatMessages)
      .values({
        sessionId: session!.id,
        userId,
        role: "user",
        contentEnc: "enc:old",
        createdAt: daysBefore(NOW, 91),
      })
      .returning({ id: schema.chatMessages.id });
    const [recentMsg] = await db!
      .insert(schema.chatMessages)
      .values({
        sessionId: session!.id,
        userId,
        role: "user",
        contentEnc: "enc:recent",
        createdAt: daysBefore(NOW, 1),
      })
      .returning({ id: schema.chatMessages.id });

    const deletedCount = await purgeOldChatMessages(db!, 90);
    expect(deletedCount).toBe(1);

    const remaining = await db!
      .select({ id: schema.chatMessages.id })
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.sessionId, session!.id));
    expect(remaining.map((r) => r.id)).toEqual([recentMsg!.id]);
    expect(remaining.map((r) => r.id)).not.toContain(oldMsg!.id);
  });

  it("purgeExpiredShareLinks deletes summaries expired/revoked beyond the window and their PDFs", async () => {
    const userId = await makeUser("summary");

    const [expiredOld] = await db!
      .insert(schema.summaries)
      .values({
        userId,
        period: "3_cycles",
        pdfKey: "summaries/expired-old.pdf",
        shareTokenHash: "a".repeat(64),
        expiresAt: daysBefore(NOW, 10),
      })
      .returning({ id: schema.summaries.id });

    const [expiredRecent] = await db!
      .insert(schema.summaries)
      .values({
        userId,
        period: "3_cycles",
        pdfKey: "summaries/expired-recent.pdf",
        shareTokenHash: "b".repeat(64),
        expiresAt: daysBefore(NOW, 2),
      })
      .returning({ id: schema.summaries.id });

    const [revokedOld] = await db!
      .insert(schema.summaries)
      .values({
        userId,
        period: "3_cycles",
        pdfKey: "summaries/revoked-old.pdf",
        shareTokenHash: "c".repeat(64),
        expiresAt: daysBefore(NOW, -60), // still "not yet expired" by date
        revokedAt: daysBefore(NOW, 8), // but revoked 8 days ago
      })
      .returning({ id: schema.summaries.id });

    const deletedCount = await purgeExpiredShareLinks(db!, 7);
    expect(deletedCount).toBe(2);
    expect(deleteObject).toHaveBeenCalledWith("summaries/expired-old.pdf");
    expect(deleteObject).toHaveBeenCalledWith("summaries/revoked-old.pdf");
    expect(deleteObject).not.toHaveBeenCalledWith(
      "summaries/expired-recent.pdf",
    );

    const remaining = await db!
      .select({ id: schema.summaries.id })
      .from(schema.summaries)
      .where(eq(schema.summaries.userId, userId));
    expect(remaining.map((r) => r.id)).toEqual([expiredRecent!.id]);
    expect(remaining.map((r) => r.id)).not.toContain(expiredOld!.id);
    expect(remaining.map((r) => r.id)).not.toContain(revokedOld!.id);
  });

  it("purgeDeletedAccounts deletes only accounts past the purge window, not freshly-requested ones", async () => {
    const oldRequestUserId = await makeUser("purge-old");
    const recentRequestUserId = await makeUser("purge-recent");
    const noRequestUserId = await makeUser("purge-none");

    await db!
      .update(schema.users)
      .set({ deletionRequestedAt: daysBefore(NOW, 31) })
      .where(eq(schema.users.id, oldRequestUserId));
    await db!
      .update(schema.users)
      .set({ deletionRequestedAt: daysBefore(NOW, 1) })
      .where(eq(schema.users.id, recentRequestUserId));

    const deletedCount = await purgeDeletedAccounts(db!, 30);
    expect(deletedCount).toBe(1);

    const remainingIds = (
      await db!
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, recentRequestUserId))
    ).map((r) => r.id);
    expect(remainingIds).toEqual([recentRequestUserId]);

    const deletedStillThere = await db!
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, oldRequestUserId));
    expect(deletedStillThere).toHaveLength(0);

    const untouched = await db!
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, noRequestUserId));
    expect(untouched).toHaveLength(1);
  });

  it("pruneAuditLog deletes only entries older than the retention window", async () => {
    const actorId = await makeUser("audit-actor");

    const [oldEntry] = await db!
      .insert(schema.accessLog)
      .values({
        actorId,
        action: "staff_access",
        entity: "staff_area",
        at: daysBefore(NOW, 400),
      })
      .returning({ id: schema.accessLog.id });
    const [recentEntry] = await db!
      .insert(schema.accessLog)
      .values({
        actorId,
        action: "staff_access",
        entity: "staff_area",
        at: daysBefore(NOW, 10),
      })
      .returning({ id: schema.accessLog.id });

    const deletedCount = await pruneAuditLog(db!, 365);
    expect(deletedCount).toBe(1);

    const remaining = await db!
      .select({ id: schema.accessLog.id })
      .from(schema.accessLog)
      .where(eq(schema.accessLog.actorId, actorId));
    expect(remaining.map((r) => r.id)).toEqual([recentEntry!.id]);
    expect(remaining.map((r) => r.id)).not.toContain(oldEntry!.id);

    await db!
      .delete(schema.accessLog)
      .where(eq(schema.accessLog.actorId, actorId));
  });
});
