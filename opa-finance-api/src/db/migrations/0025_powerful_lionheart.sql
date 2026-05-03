ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'materialize_pending';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'confirm';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'skip';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'fail';--> statement-breakpoint
ALTER TYPE "public"."audit_entity_type" ADD VALUE IF NOT EXISTS 'recurrence_occurrence';
