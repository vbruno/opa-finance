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
export const listTransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),

    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),

    accountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    subcategoryId: z.uuid().optional(),
    type: z.enum(transactionTypes).optional(),
    sort: z
      .enum(["date", "description", "account", "category", "subcategory", "type", "amount"])
      .optional(),
    dir: z.enum(["asc", "desc"]).optional(),
    description: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),

    amount: z.coerce.number().optional(),
    amountOp: z.enum(["gt", "gte", "lt", "lte"]).optional(),
    amountMin: z.coerce.number().optional(),
    amountMax: z.coerce.number().optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
    message: "Data inicial não pode ser maior que a data final",
    path: ["startDate"],
  })
  .refine((data) => !data.amountOp || data.amount !== undefined, {
    message: "amountOp requer o parâmetro amount.",
    path: ["amountOp"],
  })
  .refine(
    (data) =>
      (data.amountMin === undefined && data.amountMax === undefined) ||
      (data.amountMin !== undefined && data.amountMax !== undefined),
    {
      message: "amountMin e amountMax devem ser enviados juntos.",
      path: ["amountMin"],
    },
  )
  .refine(
    (data) =>
      data.amountMin === undefined ||
      data.amountMax === undefined ||
      data.amountMin <= data.amountMax,
    {
      message: "amountMin não pode ser maior que amountMax.",
      path: ["amountMin"],
    },
  );

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

/* -------------------------------------------------------------------------- */
/*                                 ROUTE PARAMS                                */
/* -------------------------------------------------------------------------- */

export const transactionParamsSchema = z.object({
  id: z.string().uuid({ message: "ID inválido." }),
});

export type TransactionParams = z.infer<typeof transactionParamsSchema>;

/* -------------------------------------------------------------------------- */
/*                         TRANSACTIONS SUMMARY (QUERY)                        */
/* -------------------------------------------------------------------------- */

export const summaryTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida")
    .optional(),

  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida")
    .optional(),

  accountId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  subcategoryId: z.uuid().optional(),
  type: z.enum(transactionTypes).optional(),
});

export type SummaryTransactionsQuery = z.infer<typeof summaryTransactionsQuerySchema>;

/* -------------------------------------------------------------------------- */
/*                    TOP CATEGORIES (QUERY)                                  */
/* -------------------------------------------------------------------------- */

export const topCategoriesQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida")
    .optional(),

  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida")
    .optional(),

  accountId: z.uuid().optional(),
  type: z.enum(transactionTypes).optional(),
  groupBy: z.enum(["category", "subcategory"]).default("category"),
});

export type TopCategoriesQuery = z.infer<typeof topCategoriesQuerySchema>;

/* -------------------------------------------------------------------------- */
/*                 TRANSACTION DESCRIPTIONS (QUERY)                           */
/* -------------------------------------------------------------------------- */

export const transactionDescriptionsQuerySchema = z.object({
  accountId: z.uuid({ message: "ID da conta inválido." }),
  q: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type TransactionDescriptionsQuery = z.infer<typeof transactionDescriptionsQuerySchema>;
