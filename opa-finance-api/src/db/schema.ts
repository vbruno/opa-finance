// src/db/schema.ts
// Drizzle ORM schemas for finance project
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  text,
  date,
  pgEnum,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/* ----------------------------- ENUM DEFINITIONS ----------------------------- */

export const accountTypeEnum = pgEnum("account_type", [
  "cash",
  "checking_account",
  "savings_account",
  "credit_card",
  "investment",
]);

export const categoryType = pgEnum("category_type", ["income", "expense"]);

export const transactionType = pgEnum("transaction_type", ["income", "expense"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete"]);
export const auditEntityTypeEnum = pgEnum("audit_entity_type", [
  "transaction",
  "account",
  "category",
  "subcategory",
]);

/* ---------------------------------- USERS ---------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/* --------------------------------- ACCOUNTS -------------------------------- */

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  name: text("name").notNull(),

  type: accountTypeEnum("type").notNull(),

  initialBalance: numeric("initial_balance").notNull().default("0"),

  color: text("color"),
  icon: text("icon"),
  isPrimary: boolean("is_primary").notNull().default(false),
  isHiddenOnDashboard: boolean("is_hidden_on_dashboard").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* -------------------------------- CATEGORIES -------------------------------- */

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 255 }).notNull(),

  type: categoryType("type").notNull(),

  system: boolean("system").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ------------------------------ SUBCATEGORIES ------------------------------- */

export const subcategories = pgTable("subcategories", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),

  name: text("name").notNull(),

  color: text("color"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* -------------------------------- TRANSACTIONS ------------------------------ */

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),

  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),

  subcategoryId: uuid("subcategory_id").references(() => subcategories.id, {
    onDelete: "set null",
  }),

  type: transactionType("type").notNull(),

  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),

  date: date("date").notNull(),

  description: text("description"),
  notes: text("notes"),

  transferId: uuid("transfer_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* -------------------------------- AUDIT LOGS -------------------------------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    entityType: auditEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: auditActionEnum("action").notNull(),

    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_user_created_at_idx").on(table.userId, table.createdAt),
    index("audit_logs_entity_created_at_idx").on(table.entityType, table.createdAt),
    index("audit_logs_action_created_at_idx").on(table.action, table.createdAt),
  ],
);
