import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSameOrigin } from "./csrf";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/v1/whatever", {
    method: "POST",
    headers,
  });
}

describe("assertSameOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows a same-origin request via the Origin header", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.mwezicare.org");
    const result = assertSameOrigin(
      requestWith({ origin: "https://app.mwezicare.org" }),
    );
    expect(result).toBeNull();
  });

  it("rejects a cross-origin Origin header", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.mwezicare.org");
    const result = assertSameOrigin(
      requestWith({ origin: "https://evil.example" }),
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("falls back to Referer when Origin is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.mwezicare.org");
    const result = assertSameOrigin(
      requestWith({ referer: "https://app.mwezicare.org/care" }),
    );
    expect(result).toBeNull();
  });

  it("rejects when both Origin and Referer are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.mwezicare.org");
    const result = assertSameOrigin(requestWith({}));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("rejects an invalid Referer header", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.mwezicare.org");
    const result = assertSameOrigin(requestWith({ referer: "not-a-url" }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});
