CREATE INDEX IF NOT EXISTS "recurrence_occurrences_recurrence_status_idx" ON "recurrence_occurrences" USING btree ("recurrence_id","status");
