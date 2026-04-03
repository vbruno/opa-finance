/**
 * Seed RESET (db:seed:reset)
 *
 * Objetivo:
 * - Limpar completamente os dados de negócio e recriar uma base inicial completa.
 *
 * Impacto:
 * - Remove TODOS os dados das tabelas principais (incluindo audit logs).
 * - Recria usuário demo + contas + categorias + subcategorias + transações históricas.
 *
 * Uso recomendado:
 * - Ambientes de desenvolvimento/teste quando precisar reinicializar o cenário completo.
 *
 * Segurança:
 * - Em produção exige confirmação explícita: SEED_CONFIRM=PROD_RESET_OK
 */
import { hash } from "bcrypt";
import { sql } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";

import { users } from "./schema";
import {
  DEFAULT_DEMO_PASSWORD,
  DEMO_EMAIL,
  DEMO_NAME,
  seedDemoFinanceData,
} from "./seed.shared";

async function seed() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_CONFIRM !== "PROD_RESET_OK") {
    throw new Error(
      "Seed reset em produção exige confirmação explícita: SEED_CONFIRM=PROD_RESET_OK",
    );
  }

  console.log("🌱 Iniciando seed reset (limpa tudo e recria dados iniciais)...");

  await db.execute(sql`DELETE FROM audit_logs`);
  await db.execute(sql`DELETE FROM transactions`);
  await db.execute(sql`DELETE FROM subcategories`);
  await db.execute(sql`DELETE FROM categories`);
  await db.execute(sql`DELETE FROM accounts`);
  await db.execute(sql`DELETE FROM users`);

  console.log("✔ Tabelas limpas");

  const seededPassword = DEFAULT_DEMO_PASSWORD;
  const passwordHash = await hash(seededPassword, 10);

  const [user] = await db
    .insert(users)
    .values({
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      passwordHash,
    })
    .returning();

  console.log("✔ Usuario criado:");
  console.log(`   - Demo (principal): ${user.email} / senha: ${seededPassword}`);

  const seeded = await seedDemoFinanceData(db, user.id);
  console.log(
    `✔ Transacoes criadas (${seeded.transactionsCount} lancamentos de ${seeded.startYear}-01 ate ${seeded.endYear}-${String(seeded.endMonth).padStart(2, "0")})`,
  );
  console.log("🌱 Seed finalizado com sucesso!");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro ao executar seed:", err);
  process.exit(1);
});
