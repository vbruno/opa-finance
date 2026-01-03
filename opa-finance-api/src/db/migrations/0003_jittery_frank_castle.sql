ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_user_primary_unique" ON "accounts" ("user_id") WHERE "is_primary";
