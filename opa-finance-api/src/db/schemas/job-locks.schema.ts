import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const jobLocks = pgTable(
  "job_locks",
  {
    jobKey: varchar("job_key", { length: 100 }).primaryKey(),
    ownerId: varchar("owner_id", { length: 120 }).notNull(),
    lockUntil: timestamp("lock_until").notNull(),
    lockedAt: timestamp("locked_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("job_locks_lock_until_idx").on(table.lockUntil)],
);
