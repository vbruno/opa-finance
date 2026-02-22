ALTER TABLE "accounts"
ADD COLUMN IF NOT EXISTS "is_hidden_on_dashboard" boolean DEFAULT false NOT NULL;
