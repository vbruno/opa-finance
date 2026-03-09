import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.schema";

export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete"]);

export const auditEntityTypeEnum = pgEnum("audit_entity_type", [
  "transaction",
  "account",
  "category",
  "subcategory",
]);

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
