import { z } from "zod";
import { transactionTypes } from "./transaction.enums";

/* -------------------------------------------------------------------------- */
/*                               CREATE TRANSACTION                            */
/* -------------------------------------------------------------------------- */

export const createTransactionSchema = z.object({
  accountId: z.string().uuid({ message: "ID da conta inválido." }),
  categoryId: z.string().uuid({ message: "ID da categoria inválido." }),

  subcategoryId: z.string().uuid().nullable().optional(),

  type: z.enum(transactionTypes, {
    message: "Tipo de transação inválido.",
  }),

  amount: z.coerce.number().positive({ message: "O valor da transação deve ser maior que zero." }),

  date: z.string().refine((v) => !isNaN(Date.parse(v)), { message: "Data inválida." }),

  description: z.string().max(255).optional(),

  notes: z.string().nullable().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/* -------------------------------------------------------------------------- */
/*                               UPDATE TRANSACTION                            */
/* -------------------------------------------------------------------------- */

export const updateTransactionSchema = z
  .object({
    accountId: z.string().uuid({ message: "ID da conta inválido." }).optional(),
    categoryId: z.string().uuid({ message: "ID da categoria inválido." }).optional(),
    subcategoryId: z.string().uuid().nullable().optional(),

    type: z.enum(transactionTypes, { message: "Tipo de transação inválido." }).optional(),

    amount: z.coerce
      .number()
      .positive({ message: "O valor da transação deve ser maior que zero." })
      .optional(),

    date: z
      .string()
      .refine((v) => !isNaN(Date.parse(v)), { message: "Data inválida." })
      .optional(),

    description: z.string().max(255).optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

/* -------------------------------------------------------------------------- */
/*                             LIST TRANSACTIONS (QUERY)                      */
/* -------------------------------------------------------------------------- */

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  startDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Data inicial inválida." })
    .optional(),
  endDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Data final inválida." })
    .optional(),

  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(transactionTypes).optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

/* -------------------------------------------------------------------------- */
/*                                 ROUTE PARAMS                                */
/* -------------------------------------------------------------------------- */

export const transactionParamsSchema = z.object({
  id: z.string().uuid({ message: "ID inválido." }),
});

export type TransactionParams = z.infer<typeof transactionParamsSchema>;
