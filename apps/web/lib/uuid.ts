/**
 * crypto.randomUUID() is secure-context-only (HTTPS, or http://localhost) —
 * on plain HTTP (e.g. this app's current demo deployment, which has no
 * TLS/domain yet) it's undefined, and calling it throws a TypeError. Every
 * "first log for this date" write (daily-log-form.tsx, quick-log.ts) used
 * it directly, so on HTTP those writes failed silently the moment there was
 * no existing offline record to reuse a clientId from.
 *
 * crypto.getRandomValues() has no such restriction (it works in every
 * context), so build a v4 UUID from that when randomUUID isn't available,
 * and prefer the real thing when it is (e.g. once this app is on HTTPS).
 */
export function generateUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
