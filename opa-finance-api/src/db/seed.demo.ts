/**
 * Seed DEMO (db:seed:demo)
 *
 * Objetivo:
 * - Criar/atualizar apenas o usuário demo para apresentação.
 *
 * Impacto:
 * - Remove e recria SOMENTE os dados do usuário demo alvo.
 * - Não limpa dados de outros usuários.
 *
 * Uso recomendado:
 * - Ambiente de produção ou homologação para preparar conta de demonstração sem afetar base geral.
 *
 * Segurança:
 * - Em produção exige confirmação explícita: DEMO_SEED_CONFIRM=PROD_DEMO_OK
 * - Senha pode ser sobrescrita por env: DEMO_SEED_PASSWORD
 */
import { hash } from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";
import { users } from "./schema";
import {
  DEFAULT_DEMO_PASSWORD,
  DEMO_EMAIL,
  DEMO_NAME,
  seedDemoFinanceData,
} from "./seed.shared";

async function seedDemoOnly() {
  if (process.env.NODE_ENV === "production" && process.env.DEMO_SEED_CONFIRM !== "PROD_DEMO_OK") {
    throw new Error(
      "Seed demo em produção exige confirmação explícita: DEMO_SEED_CONFIRM=PROD_DEMO_OK",
    );
  }

  const demoPassword = process.env.DEMO_SEED_PASSWORD ?? DEFAULT_DEMO_PASSWORD;
  const passwordHash = await hash(demoPassword, 10);

  console.log("🌱 Iniciando seed seguro do usuário demo...");
  console.log(`📌 Usuário alvo: ${DEMO_EMAIL}`);

  await db.transaction(async (tx) => {
    const existingDemo = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, DEMO_EMAIL))
      .limit(1);

    if (existingDemo[0]) {
      await tx.delete(users).where(eq(users.id, existingDemo[0].id));
      console.log("✔ Dados anteriores do demo removidos (somente usuário demo).");
    }

    const [demoUser] = await tx
      .insert(users)
      .values({
        name: DEMO_NAME,
        email: DEMO_EMAIL,
        passwordHash,
      })
      .returning();

    const seeded = await seedDemoFinanceData(tx, demoUser.id);
    console.log(
      `✔ Demo seed aplicado (${seeded.transactionsCount} lancamentos de ${seeded.startYear}-01 ate ${seeded.endYear}-${String(seeded.endMonth).padStart(2, "0")})`,
    );
    console.log(`✔ Login demo: ${DEMO_EMAIL} / senha: ${demoPassword}`);
  });

  console.log("🌱 Seed demo finalizado com sucesso!");
  process.exit(0);
}

seedDemoOnly().catch((err) => {
  console.error("❌ Erro ao executar seed demo:", err);
  process.exit(1);
});
