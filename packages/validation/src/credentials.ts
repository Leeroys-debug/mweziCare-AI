import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email();

// Matches Better Auth's emailAndPassword.minPasswordLength (apps/web/lib/auth.ts).
export const passwordSchema = z.string().min(8).max(128);
