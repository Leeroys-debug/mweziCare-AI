import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Threads the raw phone number from our OTP request handler through to
 * Better Auth's `sendOTP` callback without ever passing it as the
 * "phoneNumber" value Better Auth persists (that field holds the HMAC hash
 * — see lib/auth.ts and CLAUDE.md's "no plaintext phone numbers" rule).
 */
export const rawPhoneContext = new AsyncLocalStorage<string>();
