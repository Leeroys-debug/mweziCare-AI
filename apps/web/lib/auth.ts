import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { schema } from "@mwezicare/db";
import { loadServerEnv } from "@mwezicare/validation";
import { db } from "./server-db";
import { lazy } from "./lazy";

function buildAuth() {
  const env = loadServerEnv();

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
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
        locale: { type: "string", required: false, defaultValue: "en" },
      },
    },
    emailAndPassword: {
      enabled: true,
      // No email provider is wired up yet — see CLAUDE.md. Revisit once one
      // is chosen; until then, gating sign-in on a verification email would
      // lock everyone out.
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    plugins: [nextCookies()],
  });
}

// Lazy: constructing this eagerly at module-evaluation time would throw
// during Next's build-time page-data collection, before the root .env is
// loaded in that worker — see lib/lazy.ts.
export const auth: ReturnType<typeof buildAuth> = lazy(buildAuth);
