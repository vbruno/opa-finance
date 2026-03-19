import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DB } from "../../src/core/plugins/drizzle";
import { accounts, categories, subcategories, transactions, users } from "../../src/db/schema";
import { registerAndLogin } from "../helpers/auth";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe("GET /reports/consolidated", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await db.delete(transactions);
    await db.delete(subcategories);
    await db.delete(categories);
    await db.delete(accounts);
    await db.delete(users);
  });

  afterEach(async () => {
    await app.close();
  });

  it("deve retornar balanço anual sem filtro de contas", async () => {
    const { token, user } = await registerAndLogin(app, db, "bal-all@test.com", "Bal All");

    const [accountA] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta A", type: "cash", initialBalance: "0" })
      .returning();
    const [accountB] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta B", type: "checking_account", initialBalance: "0" })
      .returning();

    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Receita Fixa", type: "income", system: false })
      .returning();
    const [expenseCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Moradia", type: "expense", system: false })
      .returning();
    const [expenseNoSubCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Lazer", type: "expense", system: false })
      .returning();

    const [salarySub] = await db
      .insert(subcategories)
      .values({ userId: user.id, categoryId: incomeCategory.id, name: "Salário" })
      .returning();
    const [rentSub] = await db
      .insert(subcategories)
      .values({ userId: user.id, categoryId: expenseCategory.id, name: "Aluguel" })
      .returning();

    await db.insert(transactions).values([
      {
        userId: user.id,
        accountId: accountA.id,
        categoryId: incomeCategory.id,
        subcategoryId: salarySub.id,
        type: "income",
        amount: "1000",
        date: "2026-01-10",
      },
      {
        userId: user.id,
        accountId: accountB.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "500",
        date: "2026-02-10",
      },
      {
        userId: user.id,
        accountId: accountA.id,
        categoryId: expenseCategory.id,
        subcategoryId: rentSub.id,
        type: "expense",
        amount: "300",
        date: "2026-01-05",
      },
      {
        userId: user.id,
        accountId: accountB.id,
        categoryId: expenseNoSubCategory.id,
        subcategoryId: null,
        type: "expense",
        amount: "200",
        date: "2026-03-02",
      },
      {
        userId: user.id,
        accountId: accountA.id,
        categoryId: incomeCategory.id,
        subcategoryId: salarySub.id,
        type: "income",
        amount: "9999",
        date: "2025-01-01",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/reports/consolidated?year=2026",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.year).toBe(2026);
    expect(body.accountIds).toEqual([]);
    expect(body.income).toHaveLength(1);
    expect(body.expense).toHaveLength(2);

    const incomeCategoryRow = body.income[0];
    expect(incomeCategoryRow.categoryName).toBe("Receita Fixa");
    expect(incomeCategoryRow.months[0]).toBe(1000);
    expect(incomeCategoryRow.months[1]).toBe(500);
    expect(incomeCategoryRow.yearTotal).toBe(1500);
    expect(incomeCategoryRow.subcategories).toHaveLength(2);
    const salaryRow = incomeCategoryRow.subcategories.find(
      (item: { subcategoryName: string }) => item.subcategoryName === "Salário",
    );
    const noSubIncomeRow = incomeCategoryRow.subcategories.find(
      (item: { subcategoryName: string }) => item.subcategoryName === "Sem subcategoria",
    );
    expect(salaryRow).toBeDefined();
    expect(noSubIncomeRow).toBeDefined();
    expect(salaryRow.yearTotal).toBe(1000);
    expect(noSubIncomeRow.yearTotal).toBe(500);

    const moradiaRow = body.expense.find(
      (item: { categoryName: string }) => item.categoryName === "Moradia",
    );
    const lazerRow = body.expense.find(
      (item: { categoryName: string }) => item.categoryName === "Lazer",
    );
    expect(moradiaRow).toBeDefined();
    expect(lazerRow).toBeDefined();
    expect(moradiaRow.months[0]).toBe(300);
    expect(moradiaRow.yearTotal).toBe(300);
    expect(moradiaRow.subcategories).toHaveLength(1);
    expect(lazerRow.yearTotal).toBe(200);
    expect(lazerRow.subcategories).toHaveLength(1);
    expect(lazerRow.subcategories[0].subcategoryName).toBe("Sem subcategoria");
    expect(lazerRow.subcategories[0].yearTotal).toBe(200);

    expect(body.totals.income.yearTotal).toBe(1500);
    expect(body.totals.expense.yearTotal).toBe(500);
    expect(body.totals.income.months[0]).toBe(1000);
    expect(body.totals.income.months[1]).toBe(500);
    expect(body.totals.expense.months[0]).toBe(300);
    expect(body.totals.expense.months[2]).toBe(200);
    expect(body.totals.income.months[11]).toBe(0);
    expect(body.totals.expense.months[11]).toBe(0);
  });

  it("deve filtrar por uma conta", async () => {
    const { token, user } = await registerAndLogin(app, db, "bal-one@test.com", "Bal One");

    const [accountA] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta A", type: "cash", initialBalance: "0" })
      .returning();
    const [accountB] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta B", type: "checking_account", initialBalance: "0" })
      .returning();
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Receita", type: "income", system: false })
      .returning();

    await db.insert(transactions).values([
      {
        userId: user.id,
        accountId: accountA.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "100",
        date: "2026-01-01",
      },
      {
        userId: user.id,
        accountId: accountB.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "400",
        date: "2026-01-01",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/reports/consolidated?year=2026&accountIds=${accountA.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accountIds).toEqual([accountA.id]);
    expect(body.totals.income.yearTotal).toBe(100);
    expect(body.totals.income.months[0]).toBe(100);
  });

  it("deve filtrar por múltiplas contas", async () => {
    const { token, user } = await registerAndLogin(app, db, "bal-multi@test.com", "Bal Multi");

    const [accountA] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta A", type: "cash", initialBalance: "0" })
      .returning();
    const [accountB] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta B", type: "checking_account", initialBalance: "0" })
      .returning();
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Receita", type: "income", system: false })
      .returning();

    await db.insert(transactions).values([
      {
        userId: user.id,
        accountId: accountA.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "100",
        date: "2026-01-01",
      },
      {
        userId: user.id,
        accountId: accountB.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "400",
        date: "2026-01-01",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/reports/consolidated?year=2026&accountIds=${accountA.id},${accountB.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accountIds).toEqual([accountA.id, accountB.id]);
    expect(body.totals.income.yearTotal).toBe(500);
  });

  it("deve retornar meses zerados quando não houver movimento no ano", async () => {
    const { token, user } = await registerAndLogin(app, db, "bal-empty@test.com", "Bal Empty");

    const [account] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta A", type: "cash", initialBalance: "0" })
      .returning();
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Receita", type: "income", system: false })
      .returning();

    await db.insert(transactions).values({
      userId: user.id,
      accountId: account.id,
      categoryId: incomeCategory.id,
      subcategoryId: null,
      type: "income",
      amount: "100",
      date: "2025-01-01",
    });

    const res = await app.inject({
      method: "GET",
      url: "/reports/consolidated?year=2026",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.income).toHaveLength(0);
    expect(body.expense).toHaveLength(0);
    expect(body.totals.income.months).toEqual(Array.from({ length: 12 }, () => 0));
    expect(body.totals.expense.months).toEqual(Array.from({ length: 12 }, () => 0));
    expect(body.totals.income.yearTotal).toBe(0);
    expect(body.totals.expense.yearTotal).toBe(0);
  });

  it("deve bloquear conta que não pertence ao usuário", async () => {
    const { token, user: userA } = await registerAndLogin(
      app,
      db,
      "bal-sec-a@test.com",
      "Bal Sec A",
    );
    const { user: userB } = await registerAndLogin(app, db, "bal-sec-b@test.com", "Bal Sec B");

    const [accountB] = await db
      .insert(accounts)
      .values({ userId: userB.id, name: "Conta B", type: "cash", initialBalance: "0" })
      .returning();

    const res = await app.inject({
      method: "GET",
      url: `/reports/consolidated?year=2026&accountIds=${accountB.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(userA.id).not.toBe(userB.id);
    expect(res.statusCode).toBe(403);
  });

  it("deve validar ano inválido", async () => {
    const { token } = await registerAndLogin(app, db, "bal-year@test.com", "Bal Year");

    const res = await app.inject({
      method: "GET",
      url: "/reports/consolidated?year=1999",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve retornar 401 sem token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/consolidated?year=2026",
    });

    expect(res.statusCode).toBe(401);
  });

  it("deve listar anos com movimentação em ordem decrescente", async () => {
    const { token, user } = await registerAndLogin(app, db, "bal-years@test.com", "Bal Years");

    const [account] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta A", type: "cash", initialBalance: "0" })
      .returning();
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Receita", type: "income", system: false })
      .returning();

    await db.insert(transactions).values([
      {
        userId: user.id,
        accountId: account.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "100",
        date: "2026-01-01",
      },
      {
        userId: user.id,
        accountId: account.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "100",
        date: "2024-01-01",
      },
      {
        userId: user.id,
        accountId: account.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "100",
        date: "2025-01-01",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/reports/consolidated/years",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ years: [2026, 2025, 2024] });
  });

  it("deve filtrar anos por conta no endpoint de anos", async () => {
    const { token, user } = await registerAndLogin(
      app,
      db,
      "bal-years-account@test.com",
      "Bal Years Account",
    );

    const [accountA] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta A", type: "cash", initialBalance: "0" })
      .returning();
    const [accountB] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Conta B", type: "checking_account", initialBalance: "0" })
      .returning();
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Receita", type: "income", system: false })
      .returning();

    await db.insert(transactions).values([
      {
        userId: user.id,
        accountId: accountA.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "100",
        date: "2026-01-01",
      },
      {
        userId: user.id,
        accountId: accountB.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "100",
        date: "2025-01-01",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/reports/consolidated/years?accountIds=${accountA.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ years: [2026] });
  });
});
