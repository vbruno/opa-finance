// /test/helpers/resetTables.ts
import { DB } from "../../src/core/plugins/drizzle";

export async function resetTables(db: DB) {
  await db.execute(`
    TRUNCATE TABLE 
      transactions,
      subcategories,
      categories,
      accounts,
      users
    RESTART IDENTITY CASCADE;
  `);
}
