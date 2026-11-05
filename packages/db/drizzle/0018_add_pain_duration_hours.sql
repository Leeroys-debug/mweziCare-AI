-- pain_duration changes meaning from a 4-bucket text enum (brief/few_hours/
-- most_of_day/all_day) to specific hours (0-24) — see packages/validation's
-- painDurationHoursSchema. Existing rows written under the old enum can't be
-- cast to a number, so they're cleared rather than guessed at.
UPDATE "health"."symptom_logs" SET "pain_duration" = NULL WHERE "pain_duration" !~ '^[0-9]+$';
--> statement-breakpoint
ALTER TABLE "health"."symptom_logs" ALTER COLUMN "pain_duration" SET DATA TYPE integer USING "pain_duration"::integer;
