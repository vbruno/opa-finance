// src/modules/transactions/transaction.schemas.ts
import { z } from "zod";
import { transactionTypes } from "./transaction.enums";

/* -------------------------------------------------------------------------- */
/*                               CREATE TRANSACTION                            */
/* -------------------------------------------------------------------------- */

export const createTransactionSchema = z.object({
  accountId: z.uuid({ message: "ID da conta inválido." }),
  categoryId: z.uuid({ message: "ID da categoria inválido." }),
  subcategoryId: z.uuid({ message: "ID da subcategoria inválido." }).optional(),

  type: z.enum(transactionTypes, {
    message: "Tipo de transação inválido.",
  }),

  amount: z.coerce.number().positive({ message: "O valor da transação deve ser maior que zero." }),

  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida. Use o formato YYYY-MM-DD." }),

  description: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/* -------------------------------------------------------------------------- */
/*                               UPDATE TRANSACTION                            */
/* -------------------------------------------------------------------------- */

export const updateTransactionSchema = z
  .object({
    accountId: z.uuid({ message: "ID da conta inválido." }).optional(),
    categoryId: z.uuid({ message: "ID da categoria inválido." }).optional(),
    subcategoryId: z.uuid({ message: "ID da subcategoria inválido." }).optional(),

    type: z.enum(transactionTypes, { message: "Tipo de transação inválido." }).optional(),

    amount: z.coerce
      .number()
      .positive({ message: "O valor da transação deve ser maior que zero." })
      .optional(),

    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida. Use o formato YYYY-MM-DD." })
      .optional(),

    description: z.string().max(255).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

/* -------------------------------------------------------------------------- */
/*                                 ROUTE PARAMS                                */
/* -------------------------------------------------------------------------- */

export const transactionParamsSchema = z.object({
  id: z.uuid({ message: "ID inválido." }),
});

export type TransactionParams = z.infer<typeof transactionParamsSchema>;
