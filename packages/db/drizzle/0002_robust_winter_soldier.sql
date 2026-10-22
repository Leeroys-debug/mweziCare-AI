ALTER TABLE "health"."symptom_logs" ADD COLUMN "period_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "health"."symptom_logs" ADD COLUMN "red_flags" jsonb;--> statement-breakpoint
ALTER TABLE "health"."symptom_logs" ADD COLUMN "notes_enc" text;--> statement-breakpoint
-- Hand-edited: drizzle-kit generated a drop-and-recreate of the enum type,
-- which is lossy (any existing 'moderate' row would fail to cast into the
-- new type). Rename in place and add the new value instead — both are safe,
-- in-place ALTER TYPE operations (Postgres 10+).
ALTER TYPE "health"."bleeding_level" RENAME VALUE 'moderate' TO 'medium';--> statement-breakpoint
ALTER TYPE "health"."bleeding_level" ADD VALUE 'very_heavy' AFTER 'heavy';
