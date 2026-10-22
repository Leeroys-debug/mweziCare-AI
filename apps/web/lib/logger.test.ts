import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

function captureLogger() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  return { logger: createLogger(stream), lines };
}

describe("logger redaction", () => {
  it("redacts a top-level sensitive field", () => {
    const { logger, lines } = captureLogger();
    logger.info({ phone: "+254700000000" }, "otp sent");
    expect(lines[0]?.phone).toBe("[redacted]");
  });

  it("redacts sensitive fields nested inside an object", () => {
    const { logger, lines } = captureLogger();
    logger.info(
      { user: { email: "someone@example.com", id: "u1" } },
      "profile updated",
    );
    const user = lines[0]?.user as Record<string, unknown>;
    expect(user.email).toBe("[redacted]");
    expect(user.id).toBe("u1");
  });

  it("redacts every documented field name", () => {
    const { logger, lines } = captureLogger();
    logger.info(
      {
        phone: "a",
        email: "b",
        notes: "c",
        content: "d",
        lat: 1,
        lng: 2,
        safe: "kept",
      },
      "batch",
    );
    const entry = lines[0]!;
    for (const field of ["phone", "email", "notes", "content", "lat", "lng"]) {
      expect(entry[field]).toBe("[redacted]");
    }
    expect(entry.safe).toBe("kept");
  });

  it("leaves non-sensitive fields untouched", () => {
    const { logger, lines } = captureLogger();
    logger.info({ userId: "u1", outcome: "routine" }, "assessment generated");
    expect(lines[0]?.userId).toBe("u1");
    expect(lines[0]?.outcome).toBe("routine");
  });
});
