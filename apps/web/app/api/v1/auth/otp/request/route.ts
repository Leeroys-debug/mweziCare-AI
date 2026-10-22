import { NextResponse } from "next/server";
import { hmacLookup, consumeRateLimitToken } from "@mwezicare/db";
import { phoneNumberSchema } from "@mwezicare/validation";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";
import { logger } from "@/lib/logger";
import { rawPhoneContext } from "@/lib/otp-context";
import { db, hmacKeyProvider } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = phoneNumberSchema.safeParse(body?.phoneNumber);
  if (!parsed.success) {
    return problem(400, "Invalid phone number", parsed.error.message);
  }
  const rawPhone = parsed.data;
  const phoneHash = hmacLookup(rawPhone, hmacKeyProvider);
  const ipHash = hmacLookup(getClientIp(request.headers), hmacKeyProvider);

  // Postgres-backed token bucket, per phone hash and per IP (CLAUDE.md).
  const phoneLimit = await consumeRateLimitToken(
    db,
    `otp:phone:${phoneHash}`,
    3,
    3 / 600, // 3 requests per 10 minutes
  );
  if (!phoneLimit.allowed) {
    return problem(429, "Too many verification code requests");
  }
  const ipLimit = await consumeRateLimitToken(
    db,
    `otp:ip:${ipHash}`,
    10,
    10 / 600, // 10 requests per 10 minutes
  );
  if (!ipLimit.allowed) {
    return problem(429, "Too many requests from this network");
  }

  try {
    await rawPhoneContext.run(rawPhone, () =>
      auth.api.sendPhoneNumberOTP({ body: { phoneNumber: phoneHash } }),
    );
  } catch (error) {
    logger.error({ err: error, phoneHash }, "sendPhoneNumberOTP failed");
    return problem(500, "Could not send verification code");
  }

  return NextResponse.json({ message: "Verification code sent" });
}
