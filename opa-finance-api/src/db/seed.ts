import { hash } from "bcrypt";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";

import { users, accounts, categories, subcategories, transactions } from "./schema";

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function dateFor(month: number, day: number) {
  return `2025-${pad2(month)}-${pad2(day)}`;
}

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
  /*                            USUARIO                                          */
  /* -------------------------------------------------------------------------- */
  const passwordHash = await hash("123456", 10);

  const [user] = await db
    .insert(users)
    .values({
      name: "Usuario de Teste",
      email: "teste@teste.com",
      passwordHash,
    })
    .returning();

  console.log("✔ Usuario criado:", user.email);

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

  const [savingsAcc] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Poupanca",
      type: "savings_account",
      initialBalance: "1000",
      isPrimary: false,
    })
    .returning();

  const [creditAcc] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: "Cartao de Credito",
      type: "credit_card",
      initialBalance: "0",
      isPrimary: false,
    })
    .returning();

  console.log("✔ Contas criadas");

  /* -------------------------------------------------------------------------- */
  /*                            CATEGORIAS                                       */
  /* -------------------------------------------------------------------------- */
  const [salary] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Salario",
      type: "income",
      system: false,
    })
    .returning();

  const [transferCategory] = await db
    .insert(categories)
    .values({
      userId: null,
      name: "Transferencia",
      type: "expense",
      system: true,
    })
    .returning();

  const [food] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Alimentacao",
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

  const [health] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Saude",
      type: "expense",
      system: false,
    })
    .returning();

  const [home] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: "Casa",
      type: "expense",
      system: false,
    })
    .returning();

  console.log("✔ Categorias criadas");

  /* -------------------------------------------------------------------------- */
  /*                            SUBCATEGORIAS                                    */
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
      name: "Onibus",
    })
    .returning();

  const [transportFuel] = await db
    .insert(subcategories)
    .values({
      userId: user.id,
      categoryId: transport.id,
      name: "Combustivel",
    })
    .returning();

  const [healthPharmacy] = await db
    .insert(subcategories)
    .values({
      userId: user.id,
      categoryId: health.id,
      name: "Farmacia",
    })
    .returning();

  const [homeBills] = await db
    .insert(subcategories)
    .values({
      userId: user.id,
      categoryId: home.id,
      name: "Contas da Casa",
    })
    .returning();

  console.log("✔ Subcategorias criadas");

  /* -------------------------------------------------------------------------- */
  /*                            TRANSACOES (1 ANO)                               */
  /* -------------------------------------------------------------------------- */
  const txData = [] as (typeof transactions.$inferInsert)[];

  for (let month = 1; month <= 12; month += 1) {
    const salaryAmount = 4500 + month * 25;
    txData.push({
      userId: user.id,
      accountId: checkingAcc.id,
      categoryId: salary.id,
      type: "income",
      amount: salaryAmount.toString(),
      date: dateFor(month, 5),
      description: `Salario ${pad2(month)}/2025`,
    });

    txData.push({
      userId: user.id,
      accountId: checkingAcc.id,
      categoryId: home.id,
      subcategoryId: homeBills.id,
      type: "expense",
      amount: (850 + month * 10).toString(),
      date: dateFor(month, 10),
      description: "Contas do mes",
    });

    txData.push({
      userId: user.id,
      accountId: cashAcc.id,
      categoryId: food.id,
      subcategoryId: foodMarket.id,
      type: "expense",
      amount: (220 + month * 5).toString(),
      date: dateFor(month, 12),
      description: "Supermercado",
    });

    txData.push({
      userId: user.id,
      accountId: cashAcc.id,
      categoryId: food.id,
      subcategoryId: foodRestaurant.id,
      type: "expense",
      amount: (90 + month * 4).toString(),
      date: dateFor(month, 15),
      description: "Restaurantes",
    });

    txData.push({
      userId: user.id,
      accountId: cashAcc.id,
      categoryId: transport.id,
      subcategoryId: transportBus.id,
      type: "expense",
      amount: (60 + month * 2).toString(),
      date: dateFor(month, 18),
      description: "Onibus",
    });

    txData.push({
      userId: user.id,
      accountId: checkingAcc.id,
      categoryId: transport.id,
      subcategoryId: transportFuel.id,
      type: "expense",
      amount: (180 + month * 3).toString(),
      date: dateFor(month, 20),
      description: "Combustivel",
    });

    txData.push({
      userId: user.id,
      accountId: creditAcc.id,
      categoryId: health.id,
      subcategoryId: healthPharmacy.id,
      type: "expense",
      amount: (55 + month * 2).toString(),
      date: dateFor(month, 22),
      description: "Farmacia",
    });

    txData.push({
      userId: user.id,
      accountId: savingsAcc.id,
      categoryId: home.id,
      type: "expense",
      amount: (120 + month * 2).toString(),
      date: dateFor(month, 25),
      description: "Reserva",
    });

    const transferId = randomUUID();
    const transferAmount = 300 + month * 5;

    txData.push({
      userId: user.id,
      accountId: checkingAcc.id,
      categoryId: transferCategory.id,
      type: "expense",
      amount: transferAmount.toString(),
      date: dateFor(month, 27),
      description: "Transferencia para poupanca",
      transferId,
    });

    txData.push({
      userId: user.id,
      accountId: savingsAcc.id,
      categoryId: transferCategory.id,
      type: "income",
      amount: transferAmount.toString(),
      date: dateFor(month, 27),
      description: "Transferencia para poupanca",
      transferId,
    });
  }

  await db.insert(transactions).values(txData);

  console.log("✔ Transacoes criadas");
  console.log("🌱 Seed finalizado com sucesso!");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro ao executar seed:", err);
  process.exit(1);
});
