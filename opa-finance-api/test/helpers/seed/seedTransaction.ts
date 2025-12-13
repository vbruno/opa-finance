// test/helpers/seed/seedTransaction.ts
import type { FastifyInstance } from "fastify";
import type { TransactionType } from "@/modules/transactions/transaction.enums";

type SeedTransactionOverrides = {
  accountId: string;
  categoryId: string;
  subcategoryId?: string | null;
  type?: TransactionType;
  amount?: number;
  date?: string;
  description?: string;
  notes?: string | null;
};

export async function seedTransaction(
  app: FastifyInstance,
  token: string,
  overrides: SeedTransactionOverrides,
) {
  const payload = {
    accountId: overrides.accountId, // obrigatório
    categoryId: overrides.categoryId, // obrigatório
    subcategoryId: overrides.subcategoryId ?? null,

    type: overrides.type ?? "expense",
    amount: overrides.amount ?? 100,
    date: overrides.date ?? "2025-01-01",
    description: overrides.description ?? "Transação default",

    // Garante string ou null, nunca undefined
    notes: overrides.notes ?? null,
  };

  const res = await app.inject({
    method: "POST",
    url: "/transactions",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    payload,
  });

  return res.json();
}
