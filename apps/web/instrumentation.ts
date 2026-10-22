export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Turbopack runs this in a worker process that doesn't inherit the
    // process.env mutation next.config.ts makes in the parent CLI process,
    // so load the monorepo-root .env here too before validating it.
    const path = await import("node:path");
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(path.join(process.cwd(), "..", ".."));

    const { loadServerEnv } = await import("@mwezicare/validation");
    loadServerEnv();

    // Env must be loaded (above) before this runs, since it reads SENTRY_DSN.
    await import("./sentry.server.config");
  }
}

export const onRequestError = async (
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) => {
  if (!process.env.SENTRY_DSN) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  await captureRequestError(...args);
};
