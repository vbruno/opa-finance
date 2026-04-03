/**
 * Seed SYSTEM (db:seed:system / db:seed:system:reset)
 *
 * Objetivo:
 * - Garantir dados globais/sistêmicos mínimos (hoje: categoria global de transferência).
 *
 * Modos:
 * - padrão: modo seguro, não apaga dados e apenas garante/normaliza dados de sistema.
 * - --reset: limpa tabelas de negócio e depois recria dados de sistema.
 *
 * Uso recomendado:
 * - Manutenção de dados globais mesmo com múltiplos usuários.
 *
 * Segurança:
 * - Em produção, --reset exige confirmação explícita: SEED_CONFIRM=PROD_RESET_OK
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";
import { accounts, auditLogs, categories, subcategories, transactions, users } from "./schema";

const SYSTEM_TRANSFER_NAME = "Transferencia";
const SYSTEM_TRANSFER_DESCRIPTION =
  "Categoria tecnica para lancamentos de transferencia entre contas.";

async function seedSystem() {
  // Verifica se foi passado o flag --reset ou --clear para zerar o banco
  const shouldReset = process.argv.includes("--reset") || process.argv.includes("--clear");

  if (
    process.env.NODE_ENV === "production" &&
    shouldReset &&
    process.env.SEED_CONFIRM !== "PROD_RESET_OK"
  ) {
    throw new Error(
      "seed.system com reset em produção exige confirmação explícita: SEED_CONFIRM=PROD_RESET_OK",
    );
  }

  if (shouldReset) {
    console.log("🌱 Iniciando seed do sistema (zerando banco de dados)...");

    /* -------------------------------------------------------------------------- */
    /*                          LIMPAR TUDO (ORDEM SEGURA)                         */
    /* -------------------------------------------------------------------------- */
    await db.delete(auditLogs);
    await db.delete(transactions);
    await db.delete(subcategories);
    await db.delete(categories);
    await db.delete(accounts);
    await db.delete(users);

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
        inArray(categories.name, [SYSTEM_TRANSFER_NAME, "Transferência"]),
        eq(categories.system, true),
        isNull(categories.userId),
        eq(categories.type, "expense"),
      ),
    );

  if (existingCategory) {
    const [updatedCategory] = await db
      .update(categories)
      .set({
        name: SYSTEM_TRANSFER_NAME,
        description: SYSTEM_TRANSFER_DESCRIPTION,
        type: "expense",
        system: true,
        userId: null,
      })
      .where(eq(categories.id, existingCategory.id))
      .returning();

    console.log(`✔ Categoria de transferência já existe (${updatedCategory.id})`);
  } else {
    await db.insert(categories).values({
      userId: null, // 🔑 categoria global
      name: SYSTEM_TRANSFER_NAME,
      description: SYSTEM_TRANSFER_DESCRIPTION,
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
