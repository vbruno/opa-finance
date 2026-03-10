CREATE INDEX IF NOT EXISTS "audit_logs_user_entity_created_at_idx" ON "audit_logs" USING btree ("user_id","entity_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_action_created_at_idx" ON "audit_logs" USING btree ("user_id","action","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_transfer_id_created_at_idx" ON "audit_logs" USING btree ("user_id",((metadata ->> 'transferId')),"created_at") WHERE ((metadata ->> 'transferId') IS NOT NULL);
