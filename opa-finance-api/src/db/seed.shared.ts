import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../core/plugins/drizzle";
import { accounts, categories, subcategories, transactions } from "./schema";

type TransactionCallback = Parameters<typeof db.transaction>[0];
type SeedTx = TransactionCallback extends (tx: infer T) => Promise<unknown> ? T : never;
type SeedConnection = typeof db | SeedTx;

export const START_YEAR = 2025;
export const DEMO_EMAIL = "demo@opafinance.fake";
export const DEMO_NAME = "Ana Souza (Demo)";
export const DEFAULT_DEMO_PASSWORD = "Mudar@123";

const SYSTEM_TRANSFER_NAME = "Transferencia";
const SYSTEM_TRANSFER_DESCRIPTION =
  "Categoria tecnica para lancamentos de transferencia entre contas.";

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function dateFor(year: number, month: number, day: number, now: Date) {
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const safeDay = year === endYear && month === endMonth ? Math.min(day, currentDay) : day;

  return `${year}-${pad2(month)}-${pad2(safeDay)}`;
}

async function ensureTransferCategory(conn: SeedConnection) {
  const existingTransferCategory = await conn
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.name, SYSTEM_TRANSFER_NAME),
        eq(categories.system, true),
        isNull(categories.userId),
        eq(categories.type, "expense"),
      ),
    )
    .limit(1);

  if (existingTransferCategory[0]) {
    return existingTransferCategory[0];
  }

  const [transferCategory] = await conn
    .insert(categories)
    .values({
      userId: null,
      name: SYSTEM_TRANSFER_NAME,
      description: SYSTEM_TRANSFER_DESCRIPTION,
      type: "expense",
      system: true,
    })
    .returning({ id: categories.id });

  return transferCategory;
}

export async function seedDemoFinanceData(conn: SeedConnection, userId: string) {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const transferCategory = await ensureTransferCategory(conn);

  const [cashAcc] = await conn
    .insert(accounts)
    .values({
      userId,
      name: "Dinheiro",
      type: "cash",
      initialBalance: "150",
      isPrimary: true,
    })
    .returning();

  const [checkingAcc] = await conn
    .insert(accounts)
    .values({
      userId,
      name: "Conta Corrente",
      type: "checking_account",
      initialBalance: "2500",
      isPrimary: false,
    })
    .returning();

  const [savingsAcc] = await conn
    .insert(accounts)
    .values({
      userId,
      name: "Poupanca",
      type: "savings_account",
      initialBalance: "1000",
      isPrimary: false,
    })
    .returning();

  const [creditAcc] = await conn
    .insert(accounts)
    .values({
      userId,
      name: "Cartao de Credito",
      type: "credit_card",
      initialBalance: "0",
      isPrimary: false,
    })
    .returning();

  const [salary] = await conn
    .insert(categories)
    .values({
      userId,
      name: "Salario",
      description: "Entradas fixas mensais de trabalho principal.",
      type: "income",
      system: false,
    })
    .returning();

  const [extraIncome] = await conn
    .insert(categories)
    .values({
      userId,
      name: "Renda Extra",
      description: "Entradas complementares para demonstracao do historico.",
      type: "income",
      system: false,
    })
    .returning();

  const [food] = await conn
    .insert(categories)
    .values({
      userId,
      name: "Alimentacao",
      description: "Gastos com mercado e refeicoes.",
      type: "expense",
      system: false,
    })
    .returning();

  const [transport] = await conn
    .insert(categories)
    .values({
      userId,
      name: "Transporte",
      description: "Despesas de locomocao e deslocamentos.",
      type: "expense",
      system: false,
    })
    .returning();

  const [health] = await conn
    .insert(categories)
    .values({
      userId,
      name: "Saude",
      description: "Gastos com farmacia e cuidados de saude.",
      type: "expense",
      system: false,
    })
    .returning();

  const [home] = await conn
    .insert(categories)
    .values({
      userId,
      name: "Casa",
      description: "Custos fixos da residencia e manutencao.",
      type: "expense",
      system: false,
    })
    .returning();

  const [foodMarket] = await conn
    .insert(subcategories)
    .values({
      userId,
      categoryId: food.id,
      name: "Supermercado",
      description: "Compras mensais de mercado.",
    })
    .returning();

  const [foodRestaurant] = await conn
    .insert(subcategories)
    .values({
      userId,
      categoryId: food.id,
      name: "Restaurantes",
      description: "Consumo fora de casa.",
    })
    .returning();

  const [transportBus] = await conn
    .insert(subcategories)
    .values({
      userId,
      categoryId: transport.id,
      name: "Onibus",
      description: "Passagens e recargas de transporte publico.",
    })
    .returning();

  const [transportFuel] = await conn
    .insert(subcategories)
    .values({
      userId,
      categoryId: transport.id,
      name: "Combustivel",
      description: "Abastecimentos de veiculo.",
    })
    .returning();

  const [healthPharmacy] = await conn
    .insert(subcategories)
    .values({
      userId,
      categoryId: health.id,
      name: "Farmacia",
      description: "Medicamentos e itens de farmacia.",
    })
    .returning();

  const [homeBills] = await conn
    .insert(subcategories)
    .values({
      userId,
      categoryId: home.id,
      name: "Contas da Casa",
      description: "Custos recorrentes da residencia.",
    })
    .returning();

  const txData = [] as (typeof transactions.$inferInsert)[];

  for (let year = START_YEAR; year <= endYear; year += 1) {
    const monthLimit = year === endYear ? endMonth : 12;
    for (let month = 1; month <= monthLimit; month += 1) {
      const monthSequence = (year - START_YEAR) * 12 + month;
      const salaryAmount = 4500 + monthSequence * 25;

      txData.push({
        userId,
        accountId: checkingAcc.id,
        categoryId: salary.id,
        type: "income",
        amount: salaryAmount.toString(),
        date: dateFor(year, month, 5, now),
        description: `Salario ${pad2(month)}/${year}`,
        notes: "Receita fixa mensal",
      });

      if (year === 2025) {
        txData.push({
          userId,
          accountId: cashAcc.id,
          categoryId: extraIncome.id,
          type: "income",
          amount: (380 + month * 22).toString(),
          date: dateFor(year, month, 8, now),
          description: `Freelance ${pad2(month)}/${year}`,
          notes: "Receita adicional para demonstracao de tendencia",
        });
      }

      txData.push({
        userId,
        accountId: checkingAcc.id,
        categoryId: home.id,
        subcategoryId: homeBills.id,
        type: "expense",
        amount: (850 + monthSequence * 10).toString(),
        date: dateFor(year, month, 10, now),
        description: "Contas do mes",
        notes: "Luz, agua, internet e condominio",
      });

      txData.push({
        userId,
        accountId: cashAcc.id,
        categoryId: food.id,
        subcategoryId: foodMarket.id,
        type: "expense",
        amount: (220 + monthSequence * 5).toString(),
        date: dateFor(year, month, 12, now),
        description: "Supermercado",
        notes: "Compra semanal consolidada",
      });

      txData.push({
        userId,
        accountId: cashAcc.id,
        categoryId: food.id,
        subcategoryId: foodRestaurant.id,
        type: "expense",
        amount: (90 + monthSequence * 4).toString(),
        date: dateFor(year, month, 15, now),
        description: "Restaurantes",
        notes: "Refeicoes fora",
      });

      txData.push({
        userId,
        accountId: cashAcc.id,
        categoryId: transport.id,
        subcategoryId: transportBus.id,
        type: "expense",
        amount: (60 + monthSequence * 2).toString(),
        date: dateFor(year, month, 18, now),
        description: "Onibus",
        notes: "Transporte publico",
      });

      txData.push({
        userId,
        accountId: checkingAcc.id,
        categoryId: transport.id,
        subcategoryId: transportFuel.id,
        type: "expense",
        amount: (180 + monthSequence * 3).toString(),
        date: dateFor(year, month, 20, now),
        description: "Combustivel",
        notes: "Abastecimento",
      });

      txData.push({
        userId,
        accountId: creditAcc.id,
        categoryId: health.id,
        subcategoryId: healthPharmacy.id,
        type: "expense",
        amount: (55 + monthSequence * 2).toString(),
        date: dateFor(year, month, 22, now),
        description: "Farmacia",
        notes: "Itens de saude",
      });

      txData.push({
        userId,
        accountId: savingsAcc.id,
        categoryId: home.id,
        type: "expense",
        amount: (120 + monthSequence * 2).toString(),
        date: dateFor(year, month, 25, now),
        description: "Reserva",
        notes: "Aporte para caixa de seguranca",
      });

      const transferId = randomUUID();
      const transferAmount = 300 + monthSequence * 5;

      txData.push({
        userId,
        accountId: checkingAcc.id,
        categoryId: transferCategory.id,
        type: "expense",
        amount: transferAmount.toString(),
        date: dateFor(year, month, 27, now),
        description: "Transferencia para poupanca",
        notes: "Movimentacao interna entre contas",
        transferId,
      });

      txData.push({
        userId,
        accountId: savingsAcc.id,
        categoryId: transferCategory.id,
        type: "income",
        amount: transferAmount.toString(),
        date: dateFor(year, month, 27, now),
        description: "Transferencia para poupanca",
        notes: "Movimentacao interna entre contas",
        transferId,
      });
    }
  }

  await conn.insert(transactions).values(txData);

  return {
    transactionsCount: txData.length,
    startYear: START_YEAR,
    endYear,
    endMonth,
  };
}
