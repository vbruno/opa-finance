import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const pool = new Pool({
  // connectionString: process.env.DATABASE_URL,
  connectionString: "postgresql://api_finance_api:vEhxoc-bexxu7-donhut@localhost:5432/opa_finance",
});

export const db = drizzle(pool);

db.execute(sql`SELECT NOW()`)
  .then(() => console.log("🔥 Drizzle conectado ao banco com sucesso!"))
  .catch((err) => console.error("❌ Erro na conexão do Drizzle:", err));
