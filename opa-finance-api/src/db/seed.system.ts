// src/db/seed.system.ts
import { and, eq, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";
import { categories } from "./schema";

async function seedSystem() {
  // Verifica se foi passado o flag --reset ou --clear para zerar o banco
  const shouldReset = process.argv.includes("--reset") || process.argv.includes("--clear");

  if (shouldReset) {
    console.log("🌱 Iniciando seed do sistema (zerando banco de dados)...");

    /* -------------------------------------------------------------------------- */
    /*                          LIMPAR TUDO (ORDEM SEGURA)                         */
    /* -------------------------------------------------------------------------- */
    await db.execute(sql`DELETE FROM transactions`);
    await db.execute(sql`DELETE FROM subcategories`);
    await db.execute(sql`DELETE FROM categories`);
    await db.execute(sql`DELETE FROM accounts`);
    await db.execute(sql`DELETE FROM users`);

    console.log("✔ Banco limpo");
  } else {
    console.log("🌱 Iniciando seed do sistema (modo seguro - não deleta dados)...");
  }

  /* -------------------------------------------------------------------------- */
  /*                    CATEGORIA DE TRANSFERÊNCIA (SYSTEM)                     */
  /* -------------------------------------------------------------------------- */
  // Verifica se a categoria já existe
  const [existingCategory] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.name, "Transferência"),
        eq(categories.system, true),
        isNull(categories.userId),
      ),
    );

  if (existingCategory) {
    console.log("✔ Categoria de transferência já existe");
  } else {
    await db.insert(categories).values({
      userId: null, // 🔑 categoria global
      name: "Transferência",
      type: "expense",
      system: true,
    });

    console.log("✔ Categoria de transferência criada");
  }

  console.log("🌱 Seed do sistema finalizado com sucesso!");
  process.exit(0);
}

seedSystem().catch((err) => {
  console.error("❌ Erro ao executar seed do sistema:", err);
  process.exit(1);
});
