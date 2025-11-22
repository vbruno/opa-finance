import { hash } from "bcrypt";
import { sql } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";
import { users, accounts, categories, transactions } from "./schema";

async function seed() {
  console.log("🌱 Iniciando seed do banco...");

  // Limpar tabelas (ordem respeitando FK)
  await db.execute(sql`DELETE FROM transactions`);
  await db.execute(sql`DELETE FROM categories`);
  await db.execute(sql`DELETE FROM accounts`);
  await db.execute(sql`DELETE FROM users`);

  // Criar usuário inicial
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

  // Criar contas padrão
  const [wallet] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Carteira",
      type: "wallet",
    })
    .returning();

  const [bank] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Conta Corrente",
      type: "checking",
    })
    .returning();

  console.log("✔ Contas criadas");

  // Criar categorias padrão
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

  // Criar transações iniciais
  await db.insert(transactions).values([
    {
      userId: user.id,
      accountId: bank.id,
      categoryId: salary.id,
      type: "income",
      amount: "4500.00",
      date: "2025-01-05",
      description: "Salário do mês",
    },
    {
      userId: user.id,
      accountId: wallet.id,
      categoryId: food.id,
      type: "expense",
      amount: "50.00",
      date: "2025-01-06",
      description: "Lanche",
    },
    {
      userId: user.id,
      accountId: wallet.id,
      categoryId: transport.id,
      type: "expense",
      amount: "30.00",
      date: "2025-01-06",
      description: "Ônibus",
    },
  ]);

  console.log("✔ Transações iniciais criadas");

  console.log("🌱 Seed finalizado com sucesso!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro ao executar seed:", err);
  process.exit(1);
});
