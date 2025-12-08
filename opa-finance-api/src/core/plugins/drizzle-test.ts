// src/core/plugins/drizzle-test.ts
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../../db/schema";
import type { DB } from "./drizzle"; // <-- TIPO OFICIAL

export async function createTestDB(): Promise<DB> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_TEST,
  });

  const db = drizzle(pool, { schema }) as DB;

  // limpa todas as tabelas sem precisar de permissões
  for (const table of Object.values(schema)) {
    if (table && typeof table === "object" && "name" in table) {
      try {
        await db.execute(sql`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      } catch {
        // tabela pode não existir antes da primeira migration → ignorar
      }
    }
  }

  await migrate(db, {
    migrationsFolder: "src/db/migrations",
  });

  return db;
}
