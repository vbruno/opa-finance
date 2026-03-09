import { boolean, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.schema";

export const accountTypeEnum = pgEnum("account_type", [
  "cash",
  "checking_account",
  "savings_account",
  "credit_card",
  "investment",
]);

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
