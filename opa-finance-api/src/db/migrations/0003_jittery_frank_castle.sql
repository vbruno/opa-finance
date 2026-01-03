ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
  FROM accounts
)
UPDATE accounts AS a
SET is_primary = true
FROM ranked AS r
WHERE a.id = r.id
  AND r.rn = 1
  AND a.is_primary = false;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_user_primary_unique" ON "accounts" ("user_id") WHERE "is_primary";
