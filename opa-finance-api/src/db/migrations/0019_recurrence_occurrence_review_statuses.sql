ALTER TYPE "public"."recurrence_occurrence_status" ADD VALUE IF NOT EXISTS 'pending_review';
--> statement-breakpoint
ALTER TYPE "public"."recurrence_occurrence_status" ADD VALUE IF NOT EXISTS 'skipped';
