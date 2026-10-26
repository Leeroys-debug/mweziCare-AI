ALTER TABLE "health"."symptom_logs" ADD COLUMN "pain_timing" text[];--> statement-breakpoint
ALTER TABLE "health"."symptom_logs" ADD COLUMN "pain_persists_despite_relief" boolean;