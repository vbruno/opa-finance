ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
UPDATE "transactions" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
