import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applySecurityHeaders } from "./security-headers";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("applySecurityHeaders", () => {
  it("sets every documented security header", () => {
    const response = applySecurityHeaders(
      NextResponse.next(),
      "test-nonce-value",
    );

    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'nonce-test-nonce-value'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response.headers.get("Permissions-Policy")).toContain(
      "geolocation=(self)",
    );
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("only sets HSTS outside development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const devResponse = applySecurityHeaders(NextResponse.next(), "n");
    expect(devResponse.headers.get("Strict-Transport-Security")).toBeNull();

    vi.stubEnv("NODE_ENV", "production");
    const prodResponse = applySecurityHeaders(NextResponse.next(), "n");
    expect(prodResponse.headers.get("Strict-Transport-Security")).toContain(
      "max-age=",
    );
  });

  it("includes maplibre-gl's required allowances (workers, OSM tiles)", () => {
    const response = applySecurityHeaders(NextResponse.next(), "n");
    const csp = response.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("https://tile.openstreetmap.org");
  });
});
