// test/transaction/list-transaction.test.ts
import type { FastifyInstance } from "fastify";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql } from "drizzle-orm";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";

import type { DB } from "@/core/plugins/drizzle";

// 🔥 Faz TUDO rodar sequencialmente → IMPRESCINDÍVEL para SQLite
describe.sequential("GET /transactions (filtros + paginação)", () => {
  let app: FastifyInstance;
  let db: DB;

  // Criamos apenas UMA instância de app por teste
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await resetTables(db);
  });

  afterEach(async () => {
    await app.close();
  });

  // Helper central para criar usuário, conta e categorias
  async function seedBasicData() {
    const email = `user_${crypto.randomUUID()}@test.com`;

    const { token, user } = await registerAndLogin(app, db, email);

    // Conta
    const acc = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Conta Principal", type: "cash", initialBalance: 0 },
      })
    ).json();

    // Categoria income
    const income = (
      await app.inject({
        method: "POST",
        url: "/categories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Salário", type: "income" },
      })
    ).json();

    // Categoria expense
    const expense = (
      await app.inject({
        method: "POST",
        url: "/categories",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Mercado", type: "expense" },
      })
    ).json();

    return { token, user, account: acc, incomeCat: income, expenseCat: expense };
  }

  /* -------------------------------------------------------------------------- */
  /* 1) Deve listar apenas transações do usuário (SEM MULTIPLAS INSTÂNCIAS)     */
  /* -------------------------------------------------------------------------- */
  it("deve listar apenas transações do usuário autenticado", async () => {
    const userA = await seedBasicData();
    const userB = await seedBasicData();

    // Cria tx do usuário A
    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${userA.token}` },
      payload: {
        accountId: userA.account.id,
        categoryId: userA.incomeCat.id,
        type: "income",
        amount: 100,
        date: "2025-01-01",
      },
    });

    // Cria tx do usuário B
    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${userB.token}` },
      payload: {
        accountId: userB.account.id,
        categoryId: userB.incomeCat.id,
        type: "income",
        amount: 200,
        date: "2025-01-02",
      },
    });

    // LISTAGEM A
    const resA = await app.inject({
      method: "GET",
      url: "/transactions",
      headers: { Authorization: `Bearer ${userA.token}` },
    });

    expect(resA.statusCode).toBe(200);
    expect(resA.json().data.length).toBe(1);

    // LISTAGEM B
    const resB = await app.inject({
      method: "GET",
      url: "/transactions",
      headers: { Authorization: `Bearer ${userB.token}` },
    });

    expect(resB.json().data.length).toBe(1);
  }, 20000);

  /* -------------------------------------------------------------------------- */
  /* 2) Filtrar por período                                                     */
  /* -------------------------------------------------------------------------- */
  it("deve filtrar por período (startDate / endDate)", async () => {
    const { token, account, incomeCat } = await seedBasicData();

    const create = (amount: number, date: string) =>
      app.inject({
        method: "POST",
        url: "/transactions",
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          accountId: account.id,
          categoryId: incomeCat.id,
          type: "income",
          amount,
          date,
        },
      });

    await create(100, "2025-01-01");
    await create(200, "2025-01-10");
    await create(300, "2025-02-01");

    const res = await app.inject({
      method: "GET",
      url: "/transactions?startDate=2025-01-02&endDate=2025-01-31",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;

    expect(data.length).toBe(1);
    expect(data[0].amount).toBe(200);
  });

  /* -------------------------------------------------------------------------- */
  /* 3) Filtrar por accountId                                                   */
  /* -------------------------------------------------------------------------- */
  it("deve filtrar por accountId", async () => {
    const { token, account, incomeCat } = await seedBasicData();

    const acc2 = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        headers: { Authorization: `Bearer ${token}` },
        payload: { name: "Conta 2", type: "cash" },
      })
    ).json();

    // tx conta 1
    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 50,
        date: "2025-01-01",
      },
    });

    // tx conta 2
    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: acc2.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 80,
        date: "2025-01-02",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/transactions?accountId=${acc2.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;

    expect(data.length).toBe(1);
    expect(data[0].amount).toBe(80);
  });

  it("deve retornar 403 ao filtrar por accountId de outro usuário", async () => {
    const userA = await seedBasicData();
    const userB = await seedBasicData();

    const res = await app.inject({
      method: "GET",
      url: `/transactions?accountId=${userB.account.id}`,
      headers: { Authorization: `Bearer ${userA.token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().detail).toBe("Acesso negado à conta.");
  });

  /* -------------------------------------------------------------------------- */
  /* 4) Filtrar por categoryId + type                                           */
  /* -------------------------------------------------------------------------- */
  it("deve filtrar por categoryId e type", async () => {
    const { token, account, incomeCat, expenseCat } = await seedBasicData();

    const create = (categoryId: string, type: string, amount: number) =>
      app.inject({
        method: "POST",
        url: "/transactions",
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          accountId: account.id,
          categoryId,
          type,
          amount,
          date: "2025-01-01",
        },
      });

    await create(incomeCat.id, "income", 1000);
    await create(expenseCat.id, "expense", 200);

    const res = await app.inject({
      method: "GET",
      url: `/transactions?categoryId=${expenseCat.id}&type=expense`,
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = res.json().data;

    expect(data.length).toBe(1);
    expect(data[0].categoryId).toBe(expenseCat.id);
    expect(data[0].type).toBe("expense");
  });

  /* -------------------------------------------------------------------------- */
  /* 5) Filtros por description e notes                                         */
  /* -------------------------------------------------------------------------- */
  it("deve filtrar por description", async () => {
    const { token, account, incomeCat } = await seedBasicData();

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 100,
        date: "2025-01-01",
        description: "Bonus de performance",
      },
    });

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 200,
        date: "2025-01-02",
        description: "Pagamento mensal",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions?description=Bonus",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;

    expect(data.length).toBe(1);
    expect(data[0].description).toContain("Bonus");
  });

  it("deve filtrar por notes", async () => {
    const { token, account, incomeCat } = await seedBasicData();

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 100,
        date: "2025-01-01",
        notes: "Pix recebido do cliente",
      },
    });

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 200,
        date: "2025-01-02",
        notes: "Transferencia interna",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions?notes=Pix",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;

    expect(data.length).toBe(1);
    expect(data[0].notes).toContain("Pix");
  });

  it("deve filtrar por description sem acento", async () => {
    const { token, account, incomeCat } = await seedBasicData();

    const ext = await db.execute(sql`select 1 from pg_extension where extname = 'unaccent'`);
    const rows = (ext as { rows?: unknown[] }).rows ?? [];
    if (rows.length === 0) return;

    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 100,
        date: "2025-01-01",
        description: "Compra de ação",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions?description=acao",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;

    expect(data.length).toBe(1);
    expect(data[0].description).toBe("Compra de ação");
  });

  /* -------------------------------------------------------------------------- */
  /* 6) Paginação                                                               */
  /* -------------------------------------------------------------------------- */
  it("deve paginar corretamente (page, limit)", async () => {
    const { token, account, incomeCat } = await seedBasicData();

    for (let i = 1; i <= 15; i++) {
      await app.inject({
        method: "POST",
        url: "/transactions",
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          accountId: account.id,
          categoryId: incomeCat.id,
          type: "income",
          amount: i * 10,
          date: `2025-01-${String(i).padStart(2, "0")}`,
        },
      });
    }

    const res = await app.inject({
      method: "GET",
      url: "/transactions?page=2&limit=5",
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = res.json();

    expect(body.page).toBe(2);
    expect(body.limit).toBe(5);
    expect(body.data.length).toBe(5);
  }, 20000);

  /* -------------------------------------------------------------------------- */
  /* 7) Sem token → 401                                                         */
  /* -------------------------------------------------------------------------- */
  it("deve retornar 401 se não enviar token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/transactions",
    });

    expect(res.statusCode).toBe(401);
  });

  it("deve filtrar por subcategoryId", async () => {
    const { token, account, expenseCat } = await seedBasicData();

    const subcategory = (
      await app.inject({
        method: "POST",
        url: "/subcategories",
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: "Supermercado",
          categoryId: expenseCat.id,
        },
      })
    ).json();

    // tx COM subcategoria
    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: expenseCat.id,
        subcategoryId: subcategory.id,
        type: "expense",
        amount: 100,
        date: "2025-01-01",
      },
    });

    // tx SEM subcategoria
    await app.inject({
      method: "POST",
      url: "/transactions",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: account.id,
        categoryId: expenseCat.id,
        type: "expense",
        amount: 200,
        date: "2025-01-02",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/transactions?subcategoryId=${subcategory.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(1);
    expect(res.json().data[0].subcategoryId).toBe(subcategory.id);
  });

  it("deve retornar o total correto de registros", async () => {
    const { token, account, incomeCat } = await seedBasicData();

    for (let i = 1; i <= 12; i++) {
      await app.inject({
        method: "POST",
        url: "/transactions",
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          accountId: account.id,
          categoryId: incomeCat.id,
          type: "income",
          amount: i * 10,
          date: `2025-01-${String(i).padStart(2, "0")}`,
        },
      });
    }

    const res = await app.inject({
      method: "GET",
      url: "/transactions?page=2&limit=5",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();

    expect(body.page).toBe(2);
    expect(body.limit).toBe(5);
    expect(body.data.length).toBe(5);
    expect(body.total).toBe(12); // 👈 AQUI O VALOR IMPORTANTE
  });

  it("deve retornar erro se startDate for maior que endDate", async () => {
    const { token } = await seedBasicData();

    const res = await app.inject({
      method: "GET",
      url: "/transactions?startDate=2025-02-01&endDate=2025-01-01",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });
});
