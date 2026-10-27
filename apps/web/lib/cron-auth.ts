import { problem } from "./problem-details";

/**
 * Vercel Cron Jobs call their configured path with
 * `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set on the
 * project — these routes aren't otherwise protected (no user session is
 * involved), so this is the only thing standing between the public internet
 * and triggering a retention sweep/analytics refresh on demand. Only
 * relevant for the Vercel deployment path; the AWS/Docker worker
 * (apps/web/worker/index.ts) calls these job functions directly, never
 * through HTTP.
 */
export function verifyCronRequest(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return problem(
      500,
      "CRON_SECRET is not configured",
      "Set CRON_SECRET in the Vercel project's environment variables.",
    );
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return problem(401, "Unauthorized");
  }
  return null;
}
