import { z } from "zod";

export const summaryRangeSchema = z.enum(["3_cycles", "6_cycles", "custom"]);
export type SummaryRange = z.infer<typeof summaryRangeSchema>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const summaryCreateSchema = z
  .object({
    range: summaryRangeSchema,
    from: z.string().regex(DATE_RE).optional(),
    to: z.string().regex(DATE_RE).optional(),
    displayLabel: z.string().trim().max(60).optional(),
  })
  .refine((data) => data.range !== "custom" || (data.from && data.to), {
    message: "from and to are required when range is 'custom'",
    path: ["from"],
  });
export type SummaryCreateInput = z.infer<typeof summaryCreateSchema>;
