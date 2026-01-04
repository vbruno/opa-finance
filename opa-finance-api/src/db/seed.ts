import { hash } from "bcrypt";
import { sql } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";

import { users, accounts, categories, subcategories, transactions } from "./schema";

async function seed() {
  console.log("🌱 Iniciando seed do banco...");

  /* -------------------------------------------------------------------------- */
  /*                            LIMPAR TABELAS                                  */
  /* -------------------------------------------------------------------------- */
  await db.execute(sql`DELETE FROM transactions`);
  await db.execute(sql`DELETE FROM subcategories`);
  await db.execute(sql`DELETE FROM categories`);
  await db.execute(sql`DELETE FROM accounts`);
  await db.execute(sql`DELETE FROM users`);

  console.log("✔ Tabelas limpas");

  /* -------------------------------------------------------------------------- */
  /*                            USUÁRIO                                          */
  /* -------------------------------------------------------------------------- */
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

  /* -------------------------------------------------------------------------- */
  /*                            CONTAS                                           */
  /* -------------------------------------------------------------------------- */
  const [cashAcc] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Dinheiro",
      type: "cash",
      initialBalance: "150",
      isPrimary: true,
    })
    .returning();

  const [checkingAcc] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Conta Corrente",
      type: "checking_account",
      initialBalance: "2500",
      isPrimary: false,
    })
    .returning();

  await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Cartão de Crédito",
      type: "credit_card",
      initialBalance: "0",
      isPrimary: false,
    })
    .returning();

  console.log("✔ Contas criadas");

  /* -------------------------------------------------------------------------- */
  /*                            CATEGORIAS                                      */
  /* -------------------------------------------------------------------------- */
  const [salary] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Salário",
      type: "income",
      system: false,
    })
    .returning();

  const [food] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Alimentação",
      type: "expense",
      system: false,
    })
    .returning();

  const [transport] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Transporte",
      type: "expense",
      system: false,
    })
    .returning();

  console.log("✔ Categorias criadas");

  /* -------------------------------------------------------------------------- */
  /*                            SUBCATEGORIAS                                   */
  /* -------------------------------------------------------------------------- */
  const [foodMarket] = await db
    .insert(subcategories)
    .values({
      userId: user.id,
      categoryId: food.id,
      name: "Supermercado",
    })
    .returning();

  const [foodRestaurant] = await db
    .insert(subcategories)
    .values({
      userId: user.id,
      categoryId: food.id,
      name: "Restaurantes",
    })
    .returning();

  const [transportBus] = await db
    .insert(subcategories)
    .values({
      userId: user.id,
      categoryId: transport.id,
      name: "Ônibus",
    })
    .returning();

  console.log("✔ Subcategorias criadas");

  /* -------------------------------------------------------------------------- */
  /*                            TRANSAÇÕES                                      */
  /* -------------------------------------------------------------------------- */
  await db.insert(transactions).values([
    {
      userId: user.id,
      accountId: checkingAcc.id,
      categoryId: salary.id,
      type: "income",
      amount: "4500.00",
      date: "2025-01-05",
      description: "Salário do mês",
    },
    {
      userId: user.id,
      accountId: cashAcc.id,
      categoryId: food.id,
      subcategoryId: foodMarket.id,
      type: "expense",
      amount: "120.00",
      date: "2025-01-06",
      description: "Compras no mercado",
    },
    {
      userId: user.id,
      accountId: cashAcc.id,
      categoryId: food.id,
      subcategoryId: foodRestaurant.id,
      type: "expense",
      amount: "45.00",
      date: "2025-01-06",
      description: "Almoço fora",
    },
    {
      userId: user.id,
      accountId: cashAcc.id,
      categoryId: transport.id,
      subcategoryId: transportBus.id,
      type: "expense",
      amount: "12.00",
      date: "2025-01-06",
      description: "Ônibus",
    },
  ]);

  console.log("✔ Transações criadas");
  console.log("🌱 Seed finalizado com sucesso!");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro ao executar seed:", err);
  process.exit(1);
});
