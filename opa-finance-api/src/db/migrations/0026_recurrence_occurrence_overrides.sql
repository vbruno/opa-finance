CREATE TABLE "recurrence_occurrence_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurrence_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"amount" numeric(12, 2),
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurrence_occurrence_overrides" ADD CONSTRAINT "recurrence_occurrence_overrides_recurrence_id_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_occurrence_overrides" ADD CONSTRAINT "recurrence_occurrence_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurrence_occurrence_overrides_uidx" ON "recurrence_occurrence_overrides" USING btree ("recurrence_id","occurrence_date");--> statement-breakpoint
CREATE INDEX "recurrence_occurrence_overrides_recurrence_idx" ON "recurrence_occurrence_overrides" USING btree ("recurrence_id");