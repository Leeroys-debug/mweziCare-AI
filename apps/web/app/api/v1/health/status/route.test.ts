import { describe, expect, it, vi, afterEach } from "vitest";

const executeMock = vi.fn();
vi.mock("@/lib/server-db", () => ({ db: { execute: executeMock } }));

describe("GET /api/v1/health/status", () => {
  afterEach(() => {
    executeMock.mockReset();
  });

  it("reports ok with both checks passing", async () => {
    executeMock
      .mockResolvedValueOnce(undefined) // select 1
      .mockResolvedValueOnce([]); // no pending jobs

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "ok",
      checks: { database: "ok", queue: "ok" },
      queues: [],
    });
  });

  it("reports unhealthy with a 503 when the database check fails", async () => {
    executeMock
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce([]);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database).toBe("failed");
  });

  it("reports unhealthy with a 503 when the queue check fails", async () => {
    executeMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('relation "pgboss.job" does not exist'));

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.queue).toBe("failed");
  });

  it("computes the oldest pending job's age per queue", async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    executeMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        { queue: "retention.purge", oldest_pending: fiveMinutesAgo },
      ]);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.queues).toHaveLength(1);
    expect(body.queues[0].queue).toBe("retention.purge");
    expect(body.queues[0].oldestPendingJobAgeSeconds).toBeGreaterThanOrEqual(
      299,
    );
    expect(body.queues[0].oldestPendingJobAgeSeconds).toBeLessThanOrEqual(305);
  });
});
