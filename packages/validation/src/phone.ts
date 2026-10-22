import { z } from "zod";

/**
 * Accepts common Kenyan phone input shapes (07XXXXXXXX, 01XXXXXXXX,
 * +254XXXXXXXXX, 254XXXXXXXXX) and normalises to E.164 (+254XXXXXXXXX).
 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (/^\+254\d{9}$/.test(digits)) return digits;
  if (/^254\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+254${digits.slice(1)}`;
  return null;
}

export const phoneNumberSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeKenyanPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid Kenyan phone number",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, "Enter the verification code");
