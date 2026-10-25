import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema, type Database } from "@mwezicare/db";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. apps/web

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

let userId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: userId })),
}));
vi.mock("@/lib/server-db", async () => {
  const { EnvKeyProvider } = await import("@mwezicare/db");
  return {
    db,
    encryptionKeyProvider: new EnvKeyProvider(
      Buffer.alloc(32, 7).toString("base64"),
    ),
    analyticsKeyProvider: new EnvKeyProvider(
      Buffer.alloc(32, 9).toString("base64"),
    ),
  };
});

function validLog(overrides: Record<string, unknown> = {}) {
  return {
    clientId: "5f1c5e3a-0000-4000-8000-000000000001",
    logDate: "2026-02-01",
    periodDay: true,
    bleedingLevel: "medium" as const,
    painScore: 5,
    painLocations: ["lower_abdomen"],
    symptoms: {
      fatigue: true,
      nausea: false,
      painWithBowelMovements: false,
      painWithUrination: false,
    },
    impact: {
      missedSchool: false,
      missedWork: false,
      sleepDisrupted: false,
      activitiesLimited: false,
    },
    redFlags: {
      suddenSeverePain: false,
      fainting: false,
      possiblePregnancySuspected: false,
    },
    notes: null,
    updatedAt: "2026-02-01T08:00:00.000Z",
    ...overrides,
  };
}

describe.skipIf(!db)("POST /api/v1/logs/batch", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        email: `logs-batch-test-${Date.now()}@example.com`,
      })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("creates a new log on first sync", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/logs/batch", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ logs: [validLog()] }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].status).toBe("created");
  });

  it("retrying the exact same write (same client_id) is idempotent — no duplicate row", async () => {
    const { POST } = await import("./route");
    const log = validLog({
      clientId: "5f1c5e3a-0000-4000-8000-000000000002",
      logDate: "2026-02-02",
    });

    await POST(
      new Request("http://localhost/api/v1/logs/batch", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ logs: [log] }),
      }),
    );
    const second = await POST(
      new Request("http://localhost/api/v1/logs/batch", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ logs: [log] }),
      }),
    );
    const body = await second.json();
    expect(body.results[0].status).toBe("unchanged");

    const rows = await db!
      .select()
      .from(schema.symptomLogs)
      .where(eq(schema.symptomLogs.userId, userId));
    const matching = rows.filter((r) => r.logDate === "2026-02-02");
    expect(matching).toHaveLength(1);
  });

  it("a newer write for the same date updates the row in place (last-write-wins), no duplicate", async () => {
    const { POST } = await import("./route");
    const logDate = "2026-02-03";
    const first = validLog({
      clientId: "5f1c5e3a-0000-4000-8000-000000000003",
      logDate,
      painScore: 3,
      updatedAt: "2026-02-03T08:00:00.000Z",
    });
    const second = validLog({
      clientId: "5f1c5e3a-0000-4000-8000-000000000004",
      logDate,
      painScore: 9,
      updatedAt: "2026-02-03T09:00:00.000Z",
    });

    await POST(
      new Request("http://localhost/api/v1/logs/batch", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ logs: [first] }),
      }),
    );
    const response = await POST(
      new Request("http://localhost/api/v1/logs/batch", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ logs: [second] }),
      }),
    );
    const body = await response.json();
    expect(body.results[0].status).toBe("updated");
    expect(body.results[0].log.painScore).toBe(9);

    const rows = await db!
      .select()
      .from(schema.symptomLogs)
      .where(eq(schema.symptomLogs.userId, userId));
    const matching = rows.filter((r) => r.logDate === logDate);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.painScore).toBe(9);
  });

  it("an older/stale write for an already-updated date is dropped, not applied", async () => {
    const logDate = "2026-02-04";
    const first = validLog({
      clientId: "5f1c5e3a-0000-4000-8000-000000000005",
      logDate,
      painScore: 3,
      updatedAt: "2026-02-04T09:00:00.000Z",
    });
    const stale = validLog({
      clientId: "5f1c5e3a-0000-4000-8000-000000000006",
      logDate,
      painScore: 1,
      updatedAt: "2026-02-04T08:00:00.000Z", // earlier than `first`
    });

    const { POST: post2 } = await import("./route");
    await post2(
      new Request("http://localhost/api/v1/logs/batch", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ logs: [first] }),
      }),
    );
    const response = await post2(
      new Request("http://localhost/api/v1/logs/batch", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ logs: [stale] }),
      }),
    );
    const body = await response.json();
    expect(body.results[0].status).toBe("unchanged");
    expect(body.results[0].log.painScore).toBe(3); // server's canonical value, not the stale write
  });

  it("rejects a malformed batch", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/logs/batch", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ logs: [{ bogus: true }] }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
