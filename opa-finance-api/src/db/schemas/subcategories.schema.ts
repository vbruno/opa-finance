import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories.schema";
import { users } from "./users.schema";

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
