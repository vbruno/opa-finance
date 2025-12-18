// src/db/seed.system.ts
import { sql } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";
import { categories } from "./schema";

async function seedSystem() {
  console.log("🌱 Iniciando seed do sistema (DB zerado)...");

  /* -------------------------------------------------------------------------- */
  /*                          LIMPAR TUDO (ORDEM SEGURA)                         */
  /* -------------------------------------------------------------------------- */
  await db.execute(sql`DELETE FROM transactions`);
  await db.execute(sql`DELETE FROM subcategories`);
  await db.execute(sql`DELETE FROM categories`);
  await db.execute(sql`DELETE FROM accounts`);
  await db.execute(sql`DELETE FROM users`);

  console.log("✔ Banco limpo");

  /* -------------------------------------------------------------------------- */
  /*                    CATEGORIA DE TRANSFERÊNCIA (SYSTEM)                     */
  /* -------------------------------------------------------------------------- */
  await db.insert(categories).values({
    userId: null, // 🔑 categoria global
    name: "Transferência",
    type: "expense",
    system: true,
  });

  console.log("✔ Categoria de transferência criada");

  console.log("🌱 Seed do sistema finalizado com sucesso!");
  process.exit(0);
}

seedSystem().catch((err) => {
  console.error("❌ Erro ao executar seed do sistema:", err);
  process.exit(1);
});
