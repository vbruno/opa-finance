ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN IF EXISTS "color";
