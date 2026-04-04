ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" varchar(100) DEFAULT 'Australia/Adelaide' NOT NULL;
--> statement-breakpoint
CREATE TYPE "public"."recurrence_origin_type" AS ENUM('transaction', 'transfer');
--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'yearly');
--> statement-breakpoint
CREATE TYPE "public"."recurrence_end_type" AS ENUM('never', 'by_occurrences', 'until_date');
--> statement-breakpoint
CREATE TYPE "public"."recurrence_status" AS ENUM('active', 'finalized');
--> statement-breakpoint
CREATE TYPE "public"."recurrence_occurrence_status" AS ENUM('materialized', 'failed');
--> statement-breakpoint
CREATE TABLE "recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"origin_type" "recurrence_origin_type" NOT NULL,
	"status" "recurrence_status" DEFAULT 'active' NOT NULL,
	"timezone" text NOT NULL,
	"frequency" "recurrence_frequency" NOT NULL,
	"start_date" date NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"month_of_year" integer,
	"end_type" "recurrence_end_type" DEFAULT 'never' NOT NULL,
	"end_occurrences" integer,
	"end_date" date,
	"account_id" uuid,
	"category_id" uuid,
	"subcategory_id" uuid,
	"from_account_id" uuid,
	"to_account_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"finalized_at" timestamp,
	"deleted_at" timestamp,
	"next_occurrence_date" date,
	"last_materialized_date" date,
	"last_materialized_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurrence_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurrence_id" uuid NOT NULL,
	"origin_type" "recurrence_origin_type" NOT NULL,
	"occurrence_date" date NOT NULL,
	"status" "recurrence_occurrence_status" DEFAULT 'materialized' NOT NULL,
	"transaction_id" uuid,
	"transfer_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurrence_occurrences" ADD CONSTRAINT "recurrence_occurrences_recurrence_id_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurrences"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurrence_occurrences" ADD CONSTRAINT "recurrence_occurrences_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "recurrences_user_status_idx" ON "recurrences" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "recurrences_next_occurrence_idx" ON "recurrences" USING btree ("next_occurrence_date");
--> statement-breakpoint
CREATE INDEX "recurrences_origin_type_idx" ON "recurrences" USING btree ("origin_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "recurrence_occurrences_idempotency_uidx" ON "recurrence_occurrences" USING btree ("recurrence_id","occurrence_date","origin_type");
--> statement-breakpoint
CREATE INDEX "recurrence_occurrences_recurrence_date_idx" ON "recurrence_occurrences" USING btree ("recurrence_id","occurrence_date");
--> statement-breakpoint
CREATE INDEX "recurrence_occurrences_status_idx" ON "recurrence_occurrences" USING btree ("status");
