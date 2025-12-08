// src/core/plugins/drizzle.ts
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../db/schema"; // IMPORTANTE
import { env } from "../config/env";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// injeta o schema também na produção
export const db = drizzle(pool, { schema });

export type DB = typeof db; // <-- TIPO OFICIAL DO BANCO

// Testa conexão
db.execute(sql`SELECT NOW()`)
  .then(() => console.log("🔥 Drizzle conectado ao banco com sucesso!"))
  .catch((err) => console.error("❌ Erro na conexão do Drizzle:", err));
