import { hash } from "bcrypt";
import { sql } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";
import { users, accounts, categories, transactions } from "./schema";

async function seed() {
  console.log("🌱 Iniciando seed do banco...");

  // ---------- LIMPAR TABELAS NA ORDEM CERTA ----------
  await db.execute(sql`DELETE FROM transactions`);
  await db.execute(sql`DELETE FROM categories`);
  await db.execute(sql`DELETE FROM accounts`);
  await db.execute(sql`DELETE FROM users`);

  // ---------- CRIAR USUÁRIO INICIAL ----------
  const passwordHash = await hash("123456", 10);

  const [user] = await db
    .insert(users)
    .values({
      name: "Usuário de Teste",
      email: "teste@teste.com",
      passwordHash,
    })
    .returning();

  console.log("✔ Usuário criado:", user.email);

  // ---------- CONTAS (compátivel com seus novos enums) ----------
  // enums: ["cash","checking_account","savings_account","credit_card","investment"]

  const [cashAccount] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Dinheiro",
      type: "cash",
      initialBalance: "150.00",
    })
    .returning();

  const [checkingAccount] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Conta Corrente",
      type: "checking_account",
      initialBalance: "2500.00",
    })
    .returning();

  const [creditCard] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Cartão de Crédito",
      type: "credit_card",
      initialBalance: "0",
    })
    .returning();

  console.log("✔ Contas criadas");

  // ---------- CATEGORIAS (sem color/icon, conforme seu schema atual) ----------
  // enums: ["income","expense"]

  const [salary] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Salário",
      type: "income",
    })
    .returning();

  const [food] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Alimentação",
      type: "expense",
    })
    .returning();

  const [transport] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Transporte",
      type: "expense",
    })
    .returning();

  console.log("✔ Categorias criadas");

  // ---------- TRANSAÇÕES (compatível com seu schema) ----------
  // Campos obrigatórios: userId, accountId, categoryId, type, amount, date

  await db.insert(transactions).values([
    {
      userId: user.id,
      accountId: checkingAccount.id,
      categoryId: salary.id,
      type: "income",
      amount: "4500.00",
      date: "2025-01-05",
      description: "Salário do mês",
    },
    {
      userId: user.id,
      accountId: cashAccount.id,
      categoryId: food.id,
      type: "expense",
      amount: "42.50",
      date: "2025-01-06",
      description: "Lanche",
    },
    {
      userId: user.id,
      accountId: cashAccount.id,
      categoryId: transport.id,
      type: "expense",
      amount: "12.00",
      date: "2025-01-06",
      description: "Ônibus",
    },
  ]);

  console.log("✔ Transações criadas");

  console.log("🌱 Seed finalizado!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro ao executar seed:", err);
  process.exit(1);
});
