CREATE SCHEMA "analytics";
--> statement-breakpoint
CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "clinical";
--> statement-breakpoint
CREATE SCHEMA "facilities";
--> statement-breakpoint
CREATE SCHEMA "health";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE TYPE "health"."bleeding_level" AS ENUM('none', 'spotting', 'light', 'moderate', 'heavy');--> statement-breakpoint
CREATE TYPE "identity"."consent_purpose" AS ENUM('tracking', 'location', 'research', 'sharing');--> statement-breakpoint
CREATE TYPE "identity"."role" AS ENUM('user', 'clinician', 'verifier', 'programme_admin', 'system_admin');--> statement-breakpoint
CREATE TYPE "clinical"."ruleset_status" AS ENUM('draft', 'approved', 'retired');--> statement-breakpoint
CREATE TYPE "facilities"."service_status" AS ENUM('listed', 'verified', 'unavailable');--> statement-breakpoint
CREATE TYPE "health"."triage_outcome" AS ENUM('routine', 'assess_soon', 'urgent');--> statement-breakpoint
CREATE TABLE "identity"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "identity"."consent_purpose" NOT NULL,
	"version" integer NOT NULL,
	"granted_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "identity"."profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"age_band" text NOT NULL,
	"county" text,
	"consent_version" integer DEFAULT 1 NOT NULL,
	"guardian_consent_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"phone_enc" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"image" text,
	"role" "identity"."role" DEFAULT 'user' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health"."assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ruleset_version" integer NOT NULL,
	"outcome" "health"."triage_outcome" NOT NULL,
	"reasons" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health"."chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content_enc" text NOT NULL,
	"safety_flags" jsonb,
	"sources" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health"."chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health"."cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"predicted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health"."summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"pdf_key" text NOT NULL,
	"share_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health"."symptom_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"bleeding_level" "health"."bleeding_level",
	"pain_score" integer,
	"pain_locations" text[],
	"symptoms" jsonb,
	"impact" jsonb,
	"client_id" text NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "symptom_logs_pain_score_range" CHECK ("health"."symptom_logs"."pain_score" is null or "health"."symptom_logs"."pain_score" between 0 and 10)
);
--> statement-breakpoint
CREATE TABLE "clinical"."kb_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical"."kb_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"reviewed_by" uuid,
	"review_due" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical"."rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ruleset_id" uuid NOT NULL,
	"code" text NOT NULL,
	"definition" jsonb NOT NULL,
	"reason_en" text NOT NULL,
	"reason_sw" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical"."rulesets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"status" "clinical"."ruleset_status" DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rulesets_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "facilities"."facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kmhfl_code" text NOT NULL,
	"name" text NOT NULL,
	"county" text NOT NULL,
	"sub_county" text,
	"geom" geography(Point,4326),
	"phone" text,
	"keph_level" text,
	"ownership" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facilities_kmhfl_code_unique" UNIQUE("kmhfl_code")
);
--> statement-breakpoint
CREATE TABLE "facilities"."facility_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"service_code" text NOT NULL,
	"status" "facilities"."service_status" DEFAULT 'listed' NOT NULL,
	"verified_by" uuid,
	"last_verified_at" timestamp with time zone,
	"source" text
);
--> statement-breakpoint
CREATE TABLE "facilities"."referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"follow_up_status" text,
	"follow_up_consent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pseudo_id" text NOT NULL,
	"event_type" text NOT NULL,
	"county" text,
	"age_band" text,
	"props" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text
);
--> statement-breakpoint
ALTER TABLE "identity"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health"."assessments" ADD CONSTRAINT "assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health"."assessments" ADD CONSTRAINT "assessments_ruleset_version_rulesets_version_fk" FOREIGN KEY ("ruleset_version") REFERENCES "clinical"."rulesets"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health"."chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "health"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health"."chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health"."chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health"."cycles" ADD CONSTRAINT "cycles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health"."summaries" ADD CONSTRAINT "summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health"."symptom_logs" ADD CONSTRAINT "symptom_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical"."kb_chunks" ADD CONSTRAINT "kb_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "clinical"."kb_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical"."kb_documents" ADD CONSTRAINT "kb_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical"."rules" ADD CONSTRAINT "rules_ruleset_id_rulesets_id_fk" FOREIGN KEY ("ruleset_id") REFERENCES "clinical"."rulesets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical"."rulesets" ADD CONSTRAINT "rulesets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities"."facility_services" ADD CONSTRAINT "facility_services_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities"."facility_services" ADD CONSTRAINT "facility_services_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities"."referrals" ADD CONSTRAINT "referrals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities"."referrals" ADD CONSTRAINT "referrals_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "facilities"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."access_log" ADD CONSTRAINT "access_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consents_user_purpose_version_idx" ON "identity"."consents" USING btree ("user_id","purpose","version");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_idx" ON "identity"."sessions" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_number_idx" ON "identity"."users" USING btree ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "identity"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "chat_messages_session_idx" ON "health"."chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "summaries_share_token_hash_idx" ON "health"."summaries" USING btree ("share_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "symptom_logs_user_log_date_client_idx" ON "health"."symptom_logs" USING btree ("user_id","log_date","client_id");--> statement-breakpoint
CREATE INDEX "symptom_logs_user_log_date_idx" ON "health"."symptom_logs" USING btree ("user_id","log_date");--> statement-breakpoint
CREATE INDEX "kb_chunks_embedding_hnsw_idx" ON "clinical"."kb_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "rules_ruleset_idx" ON "clinical"."rules" USING btree ("ruleset_id");--> statement-breakpoint
CREATE INDEX "facilities_geom_idx" ON "facilities"."facilities" USING gist ("geom");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_services_facility_service_idx" ON "facilities"."facility_services" USING btree ("facility_id","service_code");--> statement-breakpoint
CREATE INDEX "events_type_occurred_idx" ON "analytics"."events" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "events_county_age_idx" ON "analytics"."events" USING btree ("county","age_band");--> statement-breakpoint
CREATE INDEX "access_log_actor_idx" ON "audit"."access_log" USING btree ("actor_id","at");