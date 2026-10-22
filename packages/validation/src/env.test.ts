import { describe, expect, it } from "vitest";
import { loadServerEnv, serverEnvSchema } from "./env";

const validEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://user:pass@localhost:5432/mwezicare",
  AUTH_SECRET: "a".repeat(32),
  AFRICASTALKING_USERNAME: "sandbox",
  AFRICASTALKING_API_KEY: "key",
  AI_GATEWAY_API_KEY: "key",
  ENCRYPTION_KEYS: '{"1":"key"}',
  ENCRYPTION_KEY_ID: "1",
  HMAC_LOOKUP_KEY: "key",
  ANALYTICS_KEY: "key",
  S3_ENDPOINT: "http://localhost:9000",
  S3_ACCESS_KEY: "key",
  S3_SECRET_KEY: "key",
  S3_BUCKET: "mwezicare-summaries",
} satisfies Record<string, string>;

describe("loadServerEnv", () => {
  it("parses a valid environment", () => {
    const env = loadServerEnv(validEnv);
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it("throws a readable error when a required variable is missing", () => {
    const { DATABASE_URL: _omit, ...rest } = validEnv;
    expect(() =>
      serverEnvSchema.parse(rest satisfies Record<string, string>),
    ).toThrow(/database_url/i);
  });

  it("parses ENCRYPTION_KEYS into a keyId -> key object", () => {
    // serverEnvSchema.parse directly, not loadServerEnv — that wrapper
    // caches its first result for the process lifetime (see env.ts), which
    // would make this assert against whatever the first test above parsed.
    const env = serverEnvSchema.parse({
      ...validEnv,
      ENCRYPTION_KEYS: '{"1":"old-key","2":"new-key"}',
      ENCRYPTION_KEY_ID: "2",
    });
    expect(env.ENCRYPTION_KEYS).toEqual({ "1": "old-key", "2": "new-key" });
  });

  it("rejects ENCRYPTION_KEYS that isn't valid JSON", () => {
    expect(() =>
      serverEnvSchema.parse({ ...validEnv, ENCRYPTION_KEYS: "not-json" }),
    ).toThrow(/ENCRYPTION_KEYS/);
  });
});
