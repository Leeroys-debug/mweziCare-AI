CREATE TYPE "clinical"."kb_status" AS ENUM('draft', 'approved');--> statement-breakpoint
ALTER TABLE "clinical"."kb_documents" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "clinical"."kb_documents" ADD COLUMN "status" "clinical"."kb_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "kb_documents_locale_slug_idx" ON "clinical"."kb_documents" USING btree ("locale","slug");