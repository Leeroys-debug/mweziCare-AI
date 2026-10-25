DROP INDEX "identity"."users_phone_number_idx";--> statement-breakpoint
ALTER TABLE "identity"."users" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "identity"."users" DROP COLUMN "phone_number_verified";--> statement-breakpoint
ALTER TABLE "identity"."users" DROP COLUMN "phone_enc";