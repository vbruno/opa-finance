// test/helpers/seed/seedTransactionsBase.ts
import type { FastifyInstance } from "fastify";
import { registerAndLogin } from "../auth";

import { seedAccount } from "./seedAccount";
import { seedCategory } from "./seedCategory";
import { seedSubcategory } from "./seedSubcategory";
import { seedTransaction } from "./seedTransaction";
import type { DB } from "@/core/plugins/drizzle";

export interface SeedOptions {
  createAccount?: boolean;
  createIncomeCategory?: boolean;
  createExpenseCategory?: boolean;
  createSubcategory?: boolean;
  createTransaction?: boolean;
}

export async function seedTransactionsBase(
  app: FastifyInstance,
  db: DB,
  options: SeedOptions = {},
) {
  const email = `seed_${crypto.randomUUID()}@test.com`;

  const { token, user } = await registerAndLogin(app, db, email);

  // --- ACCOUNT ---
  const account = options.createAccount ? await seedAccount(app, token) : null;

  // --- CATEGORIES ---
  const incomeCat = options.createIncomeCategory
    ? await seedCategory(app, token, { type: "income", name: "Salário" })
    : null;

  const expenseCat = options.createExpenseCategory
    ? await seedCategory(app, token, { type: "expense", name: "Despesas" })
    : null;

  // --- SUBCATEGORY ---
  let subcategory = null;
  if (options.createSubcategory && expenseCat) {
    subcategory = await seedSubcategory(app, token, expenseCat.id);
  }

  // --- TRANSACTION ---
  let transaction = null;
  if (options.createTransaction && account && expenseCat) {
    transaction = await seedTransaction(app, token, {
      accountId: account.id,
      categoryId: expenseCat.id,
    });
  }

  return {
    token,
    user,
    account,
    incomeCat,
    expenseCat,
    subcategory,
    transaction,
  };
}
