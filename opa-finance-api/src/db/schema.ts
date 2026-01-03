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
});
