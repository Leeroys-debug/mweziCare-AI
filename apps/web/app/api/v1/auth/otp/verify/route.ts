import { NextResponse } from "next/server";
import { hmacLookup } from "@mwezicare/db";
import { otpCodeSchema, phoneNumberSchema } from "@mwezicare/validation";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rawPhoneContext } from "@/lib/otp-context";
import { hmacKeyProvider } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = phoneNumberSchema.safeParse(body?.phoneNumber);
  const code = otpCodeSchema.safeParse(body?.code);
  if (!phone.success || !code.success) {
    return problem(400, "Invalid phone number or verification code");
  }

  const phoneHash = hmacLookup(phone.data, hmacKeyProvider);

  try {
    // User creation (first-time verification) happens inside this call, so
    // the raw phone needs to be in context here too, not just for the OTP
    // request — see databaseHooks.user.create.before in lib/auth.ts.
    const result = await rawPhoneContext.run(phone.data, () =>
      auth.api.verifyPhoneNumber({
        body: { phoneNumber: phoneHash, code: code.data },
        headers: request.headers,
        asResponse: false,
      }),
    );

    if (!result.status) {
      return problem(400, "Incorrect or expired verification code");
    }

    return NextResponse.json({ userId: result.user.id });
  } catch (error) {
    logger.error({ err: error, phoneHash }, "verifyPhoneNumber failed");
    return problem(400, "Incorrect or expired verification code");
  }
}
