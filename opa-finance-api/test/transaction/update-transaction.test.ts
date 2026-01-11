// test/transactions/update-transaction.test.ts
import type { FastifyInstance } from "fastify";
import { beforeEach, afterEach, describe, expect, it } from "vitest";

import { registerAndLogin } from "../helpers/auth";
import { resetTables } from "../helpers/resetTables";
import { buildTestApp } from "../setup";
import type { DB } from "@/core/plugins/drizzle";
import { eq } from "drizzle-orm";
import { accounts, categories, transactions } from "@/db/schema";

let app: FastifyInstance;
let db: DB;

async function createBaseTransaction() {
  const { token } = await registerAndLogin(app, db, "base@test.com", "User Base");

  // Conta
  const accountRes = await app.inject({
    method: "POST",
    url: "/accounts",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    payload: {
      name: "Conta Principal",
      type: "cash",
      initialBalance: 0,
    },
  });
  expect(accountRes.statusCode).toBe(201);
  const account = accountRes.json();

  // Categoria (expense)
  const categoryRes = await app.inject({
    method: "POST",
    url: "/categories",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    payload: {
      name: "Alimentação",
      type: "expense",
    },
  });
  expect(categoryRes.statusCode).toBe(201);
  const category = categoryRes.json();

  // Transação base
  const txRes = await app.inject({
    method: "POST",
    url: "/transactions",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    payload: {
      accountId: account.id,
      categoryId: category.id,
      type: "expense",
      amount: 100.5,
      date: "2025-01-01",
      description: "Compra de mercado",
    },
  });
  expect(txRes.statusCode).toBe(201);
  const transaction = txRes.json();

  return { token, account, category, transaction };
}

describe("PUT /transactions/:id", () => {
  beforeEach(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    await resetTables(db);
  });

  afterEach(async () => {
    await app.close();
  });

  /* ------------------------------------------------------------------------ */
  /*                          CAMINHO FELIZ / SUCESSO                         */
  /* ------------------------------------------------------------------------ */
  it("deve atualizar transação com sucesso", async () => {
    const { token, account, category } = await createBaseTransaction();

    // Cria uma transação simples para atualizar
    const created = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 100,
        date: "2025-01-01",
        description: "Compras",
      },
    });

    expect(created.statusCode).toBe(201);
    const tx = created.json();

    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${tx.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        amount: 150,
        description: "Compras maiores",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.amount).toBe(150);
    expect(body.description).toBe("Compras maiores");
  });

  /* ------------------------------------------------------------------------ */
  /*                                404 - NOT FOUND                           */
  /* ------------------------------------------------------------------------ */
  it("deve retornar 404 ao tentar atualizar transação inexistente", async () => {
    const { token } = await createBaseTransaction();

    const res = await app.inject({
      method: "PUT",
      url: "/transactions/00000000-0000-0000-0000-000000000000",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        description: "Qualquer",
      },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.title).toBe("Not Found");
    expect(body.detail).toBe("Transação não encontrada.");
  });

  /* ------------------------------------------------------------------------ */
  /*                             403 - FORBIDDEN                              */
  /* ------------------------------------------------------------------------ */
  it("não deve permitir atualizar transação de outro usuário", async () => {
    // Usuário A cria tudo
    const { token: tokenA } = await registerAndLogin(app, db, "a@test.com", "User A");

    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta A",
        type: "cash",
        initialBalance: 0,
      },
    });
    expect(accountRes.statusCode).toBe(201);
    const accountA = accountRes.json();

    const categoryRes = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Categoria A",
        type: "expense",
      },
    });
    expect(categoryRes.statusCode).toBe(201);
    const categoryA = categoryRes.json();

    const txRes = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      payload: {
        accountId: accountA.id,
        categoryId: categoryA.id,
        type: "expense",
        amount: 50,
        date: "2025-01-01",
      },
    });
    expect(txRes.statusCode).toBe(201);
    const txA = txRes.json();

    // Usuário B tenta atualizar
    const { token: tokenB } = await registerAndLogin(app, db, "b@test.com", "User B");

    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${txA.id}`,
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      payload: {
        description: "Hack",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.title).toBe("Forbidden");
    expect(body.detail).toBe("Acesso negado à transação.");
  });

  it("deve retornar 403 ao tentar mover para conta de outro usuário", async () => {
    const userA = await createBaseTransaction();

    const { token: tokenB } = await registerAndLogin(app, db, "other@test.com", "User B");

    const accountRes = await app.inject({
      method: "POST",
      url: "/accounts",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Conta B",
        type: "cash",
        initialBalance: 0,
      },
    });
    expect(accountRes.statusCode).toBe(201);
    const accountB = accountRes.json();

    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${userA.transaction.id}`,
      headers: {
        Authorization: `Bearer ${userA.token}`,
        "Content-Type": "application/json",
      },
      payload: {
        accountId: accountB.id,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().detail).toBe("Acesso negado à conta.");
  });

  it("deve atualizar transferência sem bloquear categoria de sistema", async () => {
    const { token, user } = await registerAndLogin(app, db, "transfer@test.com", "User T");

    await db.insert(categories).values({
      userId: null,
      name: "Transferência",
      type: "expense",
      system: true,
    });

    const [fromAccount] = await db
      .insert(accounts)
      .values({
        name: "Conta A",
        type: "cash",
        userId: user.id,
        initialBalance: "0",
      })
      .returning();

    const [toAccount] = await db
      .insert(accounts)
      .values({
        name: "Conta B",
        type: "cash",
        userId: user.id,
        initialBalance: "0",
      })
      .returning();

    const transferRes = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: 200,
        date: "2025-01-15",
        description: "Transferência original",
      },
    });

    expect(transferRes.statusCode).toBe(201);
    const transferBody = transferRes.json();

    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${transferBody.fromAccount.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        amount: 250,
        date: "2025-01-20",
        description: "Transferência editada",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().amount).toBe(250);
    expect(res.json().description).toBe("Transferência editada");

    const updated = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transferId, transferBody.id));

    expect(updated.length).toBe(2);
    expect(Number(updated[0].amount)).toBe(250);
    expect(Number(updated[1].amount)).toBe(250);
    expect(updated[0].date).toBe("2025-01-20");
    expect(updated[1].date).toBe("2025-01-20");
    expect(updated[0].description).toBe("Transferência editada");
    expect(updated[1].description).toBe("Transferência editada");
  });

  it("não deve permitir atualizar transferência com contas iguais", async () => {
    const { token, user } = await registerAndLogin(
      app,
      db,
      "transfer-accounts@test.com",
      "User TA",
    );

    await db.insert(categories).values({
      userId: null,
      name: "Transferência",
      type: "expense",
      system: true,
    });

    const [fromAccount] = await db
      .insert(accounts)
      .values({
        name: "Conta Origem",
        type: "cash",
        userId: user.id,
        initialBalance: "0",
      })
      .returning();

    const [toAccount] = await db
      .insert(accounts)
      .values({
        name: "Conta Destino",
        type: "cash",
        userId: user.id,
        initialBalance: "0",
      })
      .returning();

    const transferRes = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: 120,
        date: "2025-02-10",
        description: "Transferência teste",
      },
    });

    const transferBody = transferRes.json();

    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${transferBody.fromAccount.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        accountId: toAccount.id,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.title).toBe("Validation Error");
    expect(body.detail).toBe("As contas precisam ser diferentes.");
  });

  it("não deve permitir alterar categoria ou tipo em transferência", async () => {
    const { token, user } = await registerAndLogin(
      app,
      db,
      "transfer-category@test.com",
      "User TC",
    );

    await db.insert(categories).values({
      userId: null,
      name: "Transferência",
      type: "expense",
      system: true,
    });

    const [fromAccount] = await db
      .insert(accounts)
      .values({
        name: "Conta X",
        type: "cash",
        userId: user.id,
        initialBalance: "0",
      })
      .returning();

    const [toAccount] = await db
      .insert(accounts)
      .values({
        name: "Conta Y",
        type: "cash",
        userId: user.id,
        initialBalance: "0",
      })
      .returning();

    const transferRes = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: 80,
        date: "2025-02-12",
        description: "Transferência categoria",
      },
    });

    const transferBody = transferRes.json();

    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${transferBody.fromAccount.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        type: "income",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.title).toBe("Validation Error");
    expect(body.detail).toBe("Não é permitido alterar categoria ou tipo em transferências.");
  });

  /* ------------------------------------------------------------------------ */
  /*                    409 - SUBCATEGORIA NÃO PERTENCE À CATEGORIA           */
  /* ------------------------------------------------------------------------ */
  it("não deve permitir trocar para subcategoria que não pertence à categoria informada", async () => {
    const { token, account } = await createBaseTransaction();

    // Categoria 1
    const cat1Res = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Saúde",
        type: "expense",
      },
    });
    const cat1 = cat1Res.json();

    // Subcategoria ligada à categoria 1
    const sub1Res = await app.inject({
      method: "POST",
      url: "/subcategories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        categoryId: cat1.id,
        name: "Medicamentos",
      },
    });
    const sub1 = sub1Res.json();

    // Categoria 2
    const cat2Res = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Transporte",
        type: "expense",
      },
    });
    const cat2 = cat2Res.json();

    // Transação atrelada à categoria 2
    const txRes = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        accountId: account.id,
        categoryId: cat2.id,
        type: "expense",
        amount: 20,
        date: "2025-01-02",
      },
    });
    const tx = txRes.json();

    // Tenta atualizar: categoria2 + sub1 (que é da categoria1)
    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${tx.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        categoryId: cat2.id,
        subcategoryId: sub1.id,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.title).toBe("Conflict");
    expect(body.detail).toBe("A subcategoria não pertence à categoria informada.");
  });

  /* ------------------------------------------------------------------------ */
  /*                400 - TYPE INCOMPATÍVEL COM TIPO DA CATEGORIA             */
  /* ------------------------------------------------------------------------ */
  it("não deve permitir alterar tipo para incompatível com a categoria", async () => {
    const { token, account } = await createBaseTransaction();

    // Categoria income
    const incomeCatRes = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Salário",
        type: "income",
      },
    });
    const incomeCat = incomeCatRes.json();

    // Transação income
    const txRes = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        accountId: account.id,
        categoryId: incomeCat.id,
        type: "income",
        amount: 1000,
        date: "2025-01-05",
      },
    });
    const tx = txRes.json();

    // Tenta virar expense com categoria income
    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${tx.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        type: "expense",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.title).toBe("Validation Error");
    expect(body.detail).toContain("não corresponde ao tipo da categoria");
  });

  /* ------------------------------------------------------------------------ */
  /*                SUCESSO: ALTERAR CATEGORY + TYPE CONSISTENTES             */
  /* ------------------------------------------------------------------------ */
  it("deve permitir alterar categoria e tipo mantendo compatibilidade", async () => {
    const { token, account } = await createBaseTransaction();

    // Categoria expense
    const expenseCatRes = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Comida",
        type: "expense",
      },
    });
    const expenseCat = expenseCatRes.json();

    // Categoria income
    const incomeCatRes = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Salário",
        type: "income",
      },
    });
    const incomeCat = incomeCatRes.json();

    // Transação expense
    const txRes = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        accountId: account.id,
        categoryId: expenseCat.id,
        type: "expense",
        amount: 50,
        date: "2025-01-03",
      },
    });
    const tx = txRes.json();

    // Atualiza para income com categoria income
    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${tx.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {
        categoryId: incomeCat.id,
        type: "income",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.categoryId).toBe(incomeCat.id);
    expect(body.type).toBe("income");
  });

  /* ------------------------------------------------------------------------ */
  /*                  400 - NÃO PERMITIR BODY VAZIO NO UPDATE                 */
  /* ------------------------------------------------------------------------ */
  it("deve retornar 400 se body estiver vazio", async () => {
    const { token, transaction } = await createBaseTransaction();

    const res = await app.inject({
      method: "PUT",
      url: `/transactions/${transaction.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.title).toBe("Validation Error");
    expect(body.detail).toContain("Pelo menos um campo deve ser atualizado");
  });
});
