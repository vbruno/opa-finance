CREATE TABLE IF NOT EXISTS "job_locks" (
	"job_key" varchar(100) PRIMARY KEY NOT NULL,
	"owner_id" varchar(120) NOT NULL,
	"lock_until" timestamp NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_locks_lock_until_idx" ON "job_locks" USING btree ("lock_until");
