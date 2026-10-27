import { afterEach, describe, expect, it } from "vitest";
import { verifyCronRequest } from "./cron-auth";

function requestWithAuth(header: string | null): Request {
  return new Request("http://localhost/api/cron/retention", {
    headers: header ? { authorization: header } : {},
  });
}

describe("verifyCronRequest", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("rejects when CRON_SECRET isn't configured", async () => {
    delete process.env.CRON_SECRET;
    const response = verifyCronRequest(requestWithAuth(null));
    expect(response?.status).toBe(500);
  });

  it("rejects a request with no Authorization header", () => {
    process.env.CRON_SECRET = "test-secret";
    const response = verifyCronRequest(requestWithAuth(null));
    expect(response?.status).toBe(401);
  });

  it("rejects a request with the wrong bearer token", () => {
    process.env.CRON_SECRET = "test-secret";
    const response = verifyCronRequest(requestWithAuth("Bearer wrong"));
    expect(response?.status).toBe(401);
  });

  it("allows a request with the correct bearer token", () => {
    process.env.CRON_SECRET = "test-secret";
    const response = verifyCronRequest(requestWithAuth("Bearer test-secret"));
    expect(response).toBeNull();
  });
});
