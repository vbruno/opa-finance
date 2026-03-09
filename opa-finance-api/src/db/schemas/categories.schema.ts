import { boolean, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./users.schema";

export const categoryType = pgEnum("category_type", ["income", "expense"]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 255 }).notNull(),
  type: categoryType("type").notNull(),
  system: boolean("system").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
