ALTER TABLE "clinical"."rules" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clinical"."rules" ADD COLUMN "outcome" "health"."triage_outcome" NOT NULL;--> statement-breakpoint
ALTER TABLE "clinical"."rules" ADD COLUMN "clinician_note" text NOT NULL;