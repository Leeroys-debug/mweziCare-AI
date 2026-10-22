import { loadServerEnv } from "@mwezicare/validation";

/**
 * Server-only. Throws immediately if a required environment variable is
 * missing or malformed — see instrumentation.ts for the startup check.
 */
export const serverEnv = () => loadServerEnv();
