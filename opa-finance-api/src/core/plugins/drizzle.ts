import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool);

db.execute(sql`SELECT NOW()`)
  .then(() => console.log("🔥 Drizzle conectado ao banco com sucesso!"))
  .catch((err) => console.error("❌ Erro na conexão do Drizzle:", err));
