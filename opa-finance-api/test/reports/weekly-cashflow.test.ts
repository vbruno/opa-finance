import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DB } from "../../src/core/plugins/drizzle";
import { accounts, categories, subcategories, transactions, users } from "../../src/db/schema";
import { registerAndLogin } from "../helpers/auth";
import { buildTestApp } from "../setup";

let app: FastifyInstance;
let db: DB;

describe("GET /reports/weekly-cashflow", () => {
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

  it("deve aplicar conta principal por padrão e retornar colunas fixas/dinâmicas", async () => {
    const { token, user } = await registerAndLogin(app, db, "weekly-default@test.com", "Weekly");

    const [primaryAccount] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: "Conta Principal",
        type: "cash",
        initialBalance: "0",
        isPrimary: true,
      })
      .returning();
    const [secondaryAccount] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: "Conta Extra",
        type: "checking_account",
        initialBalance: "0",
        isPrimary: false,
      })
      .returning();

    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Salário", type: "income", system: false })
      .returning();
    const [expenseCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Casa", type: "expense", system: false })
      .returning();
    const [marketSubcategory] = await db
      .insert(subcategories)
      .values({ userId: user.id, categoryId: expenseCategory.id, name: "Mercado" })
      .returning();

    await db.insert(transactions).values([
      {
        userId: user.id,
        accountId: primaryAccount.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "2500",
        date: "2026-01-02",
      },
      {
        userId: user.id,
        accountId: primaryAccount.id,
        categoryId: expenseCategory.id,
        subcategoryId: marketSubcategory.id,
        type: "expense",
        amount: "300",
        date: "2026-01-03",
      },
      {
        userId: user.id,
        accountId: secondaryAccount.id,
        categoryId: expenseCategory.id,
        subcategoryId: null,
        type: "expense",
        amount: "999",
        date: "2026-01-03",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/reports/weekly-cashflow?year=2026&weekStart=monday",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.defaultAccountId).toBe(primaryAccount.id);
    expect(body.appliedAccountIds).toEqual([primaryAccount.id]);
    expect(body.summaryColumns).toEqual(["total", "received", "spent"]);

    const firstWeek = body.weeks.find((item: { week: number }) => item.week === 1);
    expect(firstWeek).toBeDefined();
    expect(firstWeek.startDate).toBe("2025-12-29");
    expect(firstWeek.endDate).toBe("2026-01-04");
    expect(firstWeek.received).toBe(2500);
    expect(firstWeek.spent).toBe(300);
    expect(firstWeek.total).toBe(2200);

    expect(body.columnsCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `cat:${incomeCategory.id}:no-subcategory`,
          type: "income",
          scope: "category",
        }),
        expect.objectContaining({
          id: `subcat:${marketSubcategory.id}`,
          type: "expense",
          scope: "subcategory",
        }),
      ]),
    );
  });

  it("deve filtrar por múltiplas contas quando accountIds for informado", async () => {
    const { token, user } = await registerAndLogin(app, db, "weekly-multi@test.com", "Weekly M");

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
      .values({ userId: user.id, name: "Renda", type: "income", system: false })
      .returning();

    await db.insert(transactions).values([
      {
        userId: user.id,
        accountId: accountA.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "100",
        date: "2026-02-01",
      },
      {
        userId: user.id,
        accountId: accountB.id,
        categoryId: incomeCategory.id,
        subcategoryId: null,
        type: "income",
        amount: "200",
        date: "2026-02-01",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/reports/weekly-cashflow?year=2026&weekStart=monday&accountIds=${accountA.id},${accountB.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.appliedAccountIds).toEqual([accountA.id, accountB.id]);

    const rowWithIncome = body.weeks.find((item: { received: number }) => item.received > 0);
    expect(rowWithIncome.received).toBe(300);
    expect(rowWithIncome.total).toBe(300);
  });

  it("deve manter semanas sem movimento zeradas", async () => {
    const { token, user } = await registerAndLogin(app, db, "weekly-empty@test.com", "Weekly E");

    const [account] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: "Conta A",
        type: "cash",
        initialBalance: "0",
        isPrimary: true,
      })
      .returning();
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Renda", type: "income", system: false })
      .returning();

    await db.insert(transactions).values({
      userId: user.id,
      accountId: account.id,
      categoryId: incomeCategory.id,
      subcategoryId: null,
      type: "income",
      amount: "100",
      date: "2025-03-10",
    });

    const res = await app.inject({
      method: "GET",
      url: "/reports/weekly-cashflow?year=2026&weekStart=monday",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.columnsCatalog).toHaveLength(0);
    expect(body.weeks.length).toBeGreaterThan(0);
    expect(
      body.weeks.every(
        (week: { total: number; spent: number; received: number }) =>
          week.total === 0 && week.spent === 0 && week.received === 0,
      ),
    ).toBe(true);
  });

  it("deve respeitar weekStart=sunday na normalização das semanas", async () => {
    const { token, user } = await registerAndLogin(app, db, "weekly-sunday@test.com", "Weekly S");

    const [account] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: "Conta A",
        type: "cash",
        initialBalance: "0",
        isPrimary: true,
      })
      .returning();
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Renda", type: "income", system: false })
      .returning();

    await db.insert(transactions).values({
      userId: user.id,
      accountId: account.id,
      categoryId: incomeCategory.id,
      subcategoryId: null,
      type: "income",
      amount: "100",
      date: "2026-01-02",
    });

    const res = await app.inject({
      method: "GET",
      url: "/reports/weekly-cashflow?year=2026&weekStart=sunday",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    const firstWeek = body.weeks.find((item: { week: number }) => item.week === 1);
    expect(firstWeek.startDate).toBe("2025-12-28");
    expect(firstWeek.endDate).toBe("2026-01-03");
    expect(firstWeek.received).toBe(100);
  });

  it("deve bloquear conta de outro usuário", async () => {
    const { token } = await registerAndLogin(app, db, "weekly-own-a@test.com", "Weekly A");
    const { user: userB } = await registerAndLogin(app, db, "weekly-own-b@test.com", "Weekly B");

    const [foreignAccount] = await db
      .insert(accounts)
      .values({ userId: userB.id, name: "Conta B", type: "cash", initialBalance: "0" })
      .returning();

    const res = await app.inject({
      method: "GET",
      url: `/reports/weekly-cashflow?year=2026&weekStart=monday&accountIds=${foreignAccount.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("deve validar weekStart inválido", async () => {
    const { token } = await registerAndLogin(app, db, "weekly-invalid@test.com", "Weekly I");

    const res = await app.inject({
      method: "GET",
      url: "/reports/weekly-cashflow?year=2026&weekStart=tuesday",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve aplicar weekStart=monday quando weekStart não for informado", async () => {
    const { token, user } = await registerAndLogin(
      app,
      db,
      "weekly-default-weekstart@test.com",
      "Weekly D",
    );

    const [account] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: "Conta A",
        type: "cash",
        initialBalance: "0",
        isPrimary: true,
      })
      .returning();
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Renda", type: "income", system: false })
      .returning();

    await db.insert(transactions).values({
      userId: user.id,
      accountId: account.id,
      categoryId: incomeCategory.id,
      subcategoryId: null,
      type: "income",
      amount: "50",
      date: "2026-01-02",
    });

    const res = await app.inject({
      method: "GET",
      url: "/reports/weekly-cashflow?year=2026",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.weekStart).toBe("monday");
    const firstWeek = body.weeks.find((item: { week: number }) => item.week === 1);
    expect(firstWeek.startDate).toBe("2025-12-29");
    expect(firstWeek.endDate).toBe("2026-01-04");
  });

  it("deve usar primeira conta disponível quando não existir conta primária", async () => {
    const { token, user } = await registerAndLogin(app, db, "weekly-fallback@test.com", "Weekly F");

    const [firstAccount] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: "Conta Antiga",
        type: "cash",
        initialBalance: "0",
        isPrimary: false,
      })
      .returning();
    await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: "Conta Nova",
        type: "checking_account",
        initialBalance: "0",
        isPrimary: false,
      })
      .returning();

    const res = await app.inject({
      method: "GET",
      url: "/reports/weekly-cashflow?year=2026&weekStart=monday",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.defaultAccountId).toBe(firstAccount.id);
    expect(body.appliedAccountIds).toEqual([firstAccount.id]);
  });

  it("deve retornar semanas normalizadas mesmo sem contas disponíveis", async () => {
    const { token } = await registerAndLogin(app, db, "weekly-no-accounts@test.com", "Weekly N");

    const res = await app.inject({
      method: "GET",
      url: "/reports/weekly-cashflow?year=2026&weekStart=monday",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.defaultAccountId).toBe(null);
    expect(body.appliedAccountIds).toEqual([]);
    expect(body.columnsCatalog).toEqual([]);
    expect(body.weeks.length).toBeGreaterThan(0);
    expect(
      body.weeks.every(
        (week: { total: number; spent: number; received: number }) =>
          week.total === 0 && week.spent === 0 && week.received === 0,
      ),
    ).toBe(true);
  });

  it("deve validar year inválido", async () => {
    const { token } = await registerAndLogin(app, db, "weekly-invalid-year@test.com", "Weekly Y");

    const res = await app.inject({
      method: "GET",
      url: "/reports/weekly-cashflow?year=1999&weekStart=monday",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deve retornar 401 sem token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/weekly-cashflow?year=2026&weekStart=monday",
    });

    expect(res.statusCode).toBe(401);
  });
});
