import { sql } from "drizzle-orm";
import type { Database } from "./client";

export interface TokenBucketResult {
  allowed: boolean;
  tokensRemaining: number;
}

/**
 * Atomically consumes one token from a Postgres-backed token bucket keyed
 * by `key` (e.g. `otp:phone:<hmac hash>`, `otp:ip:<hmac hash>`). Refills at
 * `refillPerSecond` up to `capacity`, computed from the time elapsed since
 * the bucket's last update — a single upsert, so concurrent requests can't
 * race past the limit.
 */
export async function consumeRateLimitToken(
  db: Database,
  key: string,
  capacity: number,
  refillPerSecond: number,
): Promise<TokenBucketResult> {
  const rows = await db.execute<{ tokens: number }>(sql`
    insert into identity.rate_limit_buckets (key, tokens, updated_at)
    values (${key}, ${capacity} - 1, now())
    on conflict (key) do update set
      tokens = least(
        ${capacity},
        identity.rate_limit_buckets.tokens
          + extract(epoch from (now() - identity.rate_limit_buckets.updated_at)) * ${refillPerSecond}
      ) - 1,
      updated_at = now()
    returning tokens
  `);

  const tokens = Number(rows[0]?.tokens ?? -1);
  return { allowed: tokens >= 0, tokensRemaining: Math.max(0, tokens) };
}
