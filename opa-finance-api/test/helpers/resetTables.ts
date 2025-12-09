import { DB } from "@/core/plugins/drizzle";
import { transactions, accounts, users, categories } from "@/db/schema";

export async function resetTables(db: DB) {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
}
