DO $$ BEGIN
  CREATE TYPE "public"."recurrence_posting_mode" AS ENUM('automatic', 'review_required');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "recurrences" ADD COLUMN IF NOT EXISTS "posting_mode" "recurrence_posting_mode" DEFAULT 'automatic' NOT NULL;
--> statement-breakpoint
ALTER TABLE "recurrence_occurrences" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "recurrence_occurrences" ADD COLUMN IF NOT EXISTS "review_payload" jsonb;
