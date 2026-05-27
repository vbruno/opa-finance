ALTER TABLE "transactions" ADD COLUMN "recurrence_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrence_id_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurrences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill: link historical transactions to their originating recurrence via recurrence_occurrences (transactionId path).
UPDATE "transactions"
SET "recurrence_id" = ro."recurrence_id"
FROM "recurrence_occurrences" ro
WHERE "transactions"."id" = ro."transaction_id";--> statement-breakpoint
-- Backfill: link historical transfer legs (two transactions sharing the same transfer_id) via recurrence_occurrences (transferId path).
UPDATE "transactions"
SET "recurrence_id" = ro."recurrence_id"
FROM "recurrence_occurrences" ro
WHERE "transactions"."transfer_id" = ro."transfer_id"
  AND ro."transfer_id" IS NOT NULL
  AND "transactions"."recurrence_id" IS NULL;