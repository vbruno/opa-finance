import { date, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts.schema";
import { categories } from "./categories.schema";
import { subcategories } from "./subcategories.schema";
import { users } from "./users.schema";

export const transactionType = pgEnum("transaction_type", ["income", "expense"]);

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
