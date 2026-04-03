/**
 * Seed EMPTY (db:seed:empty)
 *
 * Objetivo:
 * - Deixar o banco "zerado", sem dados de usuários e sem dados transacionais.
 *
 * Impacto:
 * - Remove TODOS os dados das tabelas principais (incluindo audit logs).
 * - Não recria dados automaticamente.
 *
 * Uso recomendado:
 * - Quando for iniciar um ambiente do zero, antes de aplicar outro seed específico.
 *
 * Segurança:
 * - Em produção exige confirmação explícita: SEED_CONFIRM=PROD_EMPTY_OK
 */
import { sql } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";

async function seedEmpty() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_CONFIRM !== "PROD_EMPTY_OK") {
    throw new Error(
      "Seed empty em produção exige confirmação explícita: SEED_CONFIRM=PROD_EMPTY_OK",
    );
  }

  console.log("🧨 Iniciando seed empty (banco zerado)...");

  // Ordem segura para evitar conflito de FK em ambientes sem cascade integral
  await db.execute(sql`DELETE FROM audit_logs`);
  await db.execute(sql`DELETE FROM transactions`);
  await db.execute(sql`DELETE FROM subcategories`);
  await db.execute(sql`DELETE FROM categories`);
  await db.execute(sql`DELETE FROM accounts`);
  await db.execute(sql`DELETE FROM users`);

  console.log("✔ Banco zerado com sucesso.");
  process.exit(0);
}

seedEmpty().catch((err) => {
  console.error("❌ Erro ao executar seed empty:", err);
  process.exit(1);
});
