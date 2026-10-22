/** Works with both a Request's `.headers` and next/headers()'s ReadonlyHeaders. */
export function getClientIp(headers: {
  get(name: string): string | null;
}): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
