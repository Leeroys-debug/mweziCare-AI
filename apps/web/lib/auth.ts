import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { schema, encryptField } from "@mwezicare/db";
import { loadServerEnv } from "@mwezicare/validation";
import { db, encryptionKeyProvider } from "./server-db";
import { createSmsSender } from "./sms";
import { rawPhoneContext } from "./otp-context";
import { lazy } from "./lazy";

function buildAuth() {
  const env = loadServerEnv();
  const smsSender = createSmsSender();

  return betterAuth({
    secret: env.AUTH_SECRET,
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema,
    }),
    advanced: {
      // Keeps Better Auth's generated ids as uuids, matching every other
      // table's uuid primary/foreign keys (see packages/db/src/schema).
      database: { generateId: "uuid" },
      // Explicit (matches Better Auth's own default) per CLAUDE.md/F1:
      // session cookies must be SameSite=Lax, never None.
      defaultCookieAttributes: { sameSite: "lax" },
    },
    session: {
      // 30-day idle expiry (CLAUDE.md / architecture doc).
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        // The real phone number, AES-256-GCM encrypted — never plaintext.
        // Set in databaseHooks.user.create.before below, not client input.
        phoneEnc: { type: "string", required: false, input: false },
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
        locale: { type: "string", required: false, defaultValue: "en" },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const rawPhone = rawPhoneContext.getStore();
            if (!rawPhone) return;
            return {
              data: {
                ...user,
                phoneEnc: encryptField(rawPhone, encryptionKeyProvider),
              },
            };
          },
        },
      },
    },
    plugins: [
      phoneNumber({
        otpLength: 6,
        expiresIn: 300, // 5 minutes (CLAUDE.md / architecture doc)
        allowedAttempts: 3,
        // `phoneNumber` here is never the raw number — our /api/v1/auth/otp/*
        // routes pass the HMAC hash (hmacLookup) as the identifier Better
        // Auth stores and threads through this callback. The raw number for
        // SMS delivery comes from rawPhoneContext, set by that same route.
        sendOTP: async ({ phoneNumber: hash, code }) => {
          const rawPhone = rawPhoneContext.getStore();
          if (!rawPhone) {
            throw new Error(
              `OTP requested for ${hash} without a raw phone number in context`,
            );
          }
          await smsSender.sendOtp(rawPhone, code);
        },
        signUpOnVerification: {
          getTempEmail: (hash) => `${hash}@phone.mwezicare.invalid`,
          getTempName: () => "",
        },
      }),
      nextCookies(),
    ],
  });
}

// Lazy: constructing this eagerly at module-evaluation time would throw
// during Next's build-time page-data collection, before the root .env is
// loaded in that worker — see lib/lazy.ts.
export const auth: ReturnType<typeof buildAuth> = lazy(buildAuth);
