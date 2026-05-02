import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { accounts } from "./accounts.schema";
import { categories } from "./categories.schema";
import { subcategories } from "./subcategories.schema";
import { transactions } from "./transactions.schema";
import { users } from "./users.schema";

export const recurrenceOriginTypeEnum = pgEnum("recurrence_origin_type", [
  "transaction",
  "transfer",
]);
export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
]);
export const recurrenceEndTypeEnum = pgEnum("recurrence_end_type", [
  "never",
  "by_occurrences",
  "until_date",
]);
export const recurrenceStatusEnum = pgEnum("recurrence_status", ["active", "finalized"]);
export const recurrencePostingModeEnum = pgEnum("recurrence_posting_mode", [
  "automatic",
  "review_required",
]);
export const recurrenceOccurrenceStatusEnum = pgEnum("recurrence_occurrence_status", [
  "materialized",
  "failed",
  "pending_review",
  "skipped",
]);

export const recurrences = pgTable(
  "recurrences",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    originType: recurrenceOriginTypeEnum("origin_type").notNull(),
    status: recurrenceStatusEnum("status").notNull().default("active"),
    postingMode: recurrencePostingModeEnum("posting_mode").notNull().default("automatic"),
    timezone: text("timezone").notNull(),

    frequency: recurrenceFrequencyEnum("frequency").notNull(),
    startDate: date("start_date").notNull(),

    dayOfWeek: integer("day_of_week"),
    dayOfMonth: integer("day_of_month"),
    monthOfYear: integer("month_of_year"),

    endType: recurrenceEndTypeEnum("end_type").notNull().default("never"),
    endOccurrences: integer("end_occurrences"),
    endDate: date("end_date"),

    // Base fields for transaction recurrence
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    subcategoryId: uuid("subcategory_id").references(() => subcategories.id, {
      onDelete: "set null",
    }),

    // Base fields for transfer recurrence
    fromAccountId: uuid("from_account_id").references(() => accounts.id, { onDelete: "set null" }),
    toAccountId: uuid("to_account_id").references(() => accounts.id, { onDelete: "set null" }),

    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: text("description"),
    notes: text("notes"),

    version: integer("version").notNull().default(1),
    finalizedAt: timestamp("finalized_at"),
    deletedAt: timestamp("deleted_at"),
    nextOccurrenceDate: date("next_occurrence_date"),
    lastMaterializedDate: date("last_materialized_date"),
    lastMaterializedAt: timestamp("last_materialized_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("recurrences_user_status_idx").on(table.userId, table.status),
    index("recurrences_next_occurrence_idx").on(table.nextOccurrenceDate),
    index("recurrences_origin_type_idx").on(table.originType),
  ],
);

export const recurrenceOccurrences = pgTable(
  "recurrence_occurrences",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    recurrenceId: uuid("recurrence_id")
      .notNull()
      .references(() => recurrences.id, { onDelete: "cascade" }),

    originType: recurrenceOriginTypeEnum("origin_type").notNull(),
    occurrenceDate: date("occurrence_date").notNull(),
    status: recurrenceOccurrenceStatusEnum("status").notNull().default("materialized"),

    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    transferId: uuid("transfer_id"),

    metadata: jsonb("metadata"),
    reviewPayload: jsonb("review_payload"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("recurrence_occurrences_idempotency_uidx").on(
      table.recurrenceId,
      table.occurrenceDate,
      table.originType,
    ),
    index("recurrence_occurrences_recurrence_date_idx").on(
      table.recurrenceId,
      table.occurrenceDate,
    ),
    index("recurrence_occurrences_recurrence_status_idx").on(table.recurrenceId, table.status),
    index("recurrence_occurrences_status_idx").on(table.status),
  ],
);
