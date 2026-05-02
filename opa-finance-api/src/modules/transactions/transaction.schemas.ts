import { z } from "zod";
import { ISO_DATE_REGEX, isValidIsoDate } from "../../core/utils/recurrence-schedule.utils";
import { transactionTypes } from "./transaction.enums";

const recurrenceFrequencySchema = z.enum(["weekly", "biweekly", "monthly", "yearly"]);
const recurrenceEndTypeSchema = z.enum(["never", "by_occurrences", "until_date"]);
const recurrencePostingModeSchema = z.enum(["automatic", "review_required"]);

const createTransactionRecurrenceSchema = z
  .object({
    postingMode: recurrencePostingModeSchema.default("automatic"),
    frequency: recurrenceFrequencySchema,
    startDate: z
      .string()
      .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
      .refine(isValidIsoDate, { message: "Data inválida." })
      .optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    monthOfYear: z.number().int().min(1).max(12).optional(),
    endType: recurrenceEndTypeSchema.default("never"),
    endOccurrences: z.number().int().min(1).optional(),
    endDate: z
      .string()
      .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
      .refine(isValidIsoDate, { message: "Data inválida." })
      .optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.frequency === "weekly" || data.frequency === "biweekly") &&
      data.dayOfWeek === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dia da semana é obrigatório para frequência semanal/quinzenal.",
        path: ["dayOfWeek"],
      });
    }

    if (data.frequency === "monthly" && data.dayOfMonth === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dia do mês é obrigatório para frequência mensal.",
        path: ["dayOfMonth"],
      });
    }

    if (data.frequency === "yearly") {
      if (data.monthOfYear === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Mês é obrigatório para frequência anual.",
          path: ["monthOfYear"],
        });
      }
      if (data.dayOfMonth === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dia do mês é obrigatório para frequência anual.",
          path: ["dayOfMonth"],
        });
      }
    }

    if (data.endType === "by_occurrences" && data.endOccurrences === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quantidade de ocorrências é obrigatória para este tipo de término.",
        path: ["endOccurrences"],
      });
    }

    if (data.endType === "until_date" && data.endDate === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data final é obrigatória para este tipo de término.",
        path: ["endDate"],
      });
    }
  });

/* -------------------------------------------------------------------------- */
/*                               CREATE TRANSACTION                            */
/* -------------------------------------------------------------------------- */

export const createTransactionSchema = z
  .object({
    accountId: z.string().uuid({ message: "ID da conta inválido." }),
    categoryId: z.string().uuid({ message: "ID da categoria inválido." }),

    subcategoryId: z.string().uuid().nullable().optional(),

    type: z.enum(transactionTypes, {
      message: "Tipo de transação inválido.",
    }),

    amount: z.coerce
      .number()
      .positive({ message: "O valor da transação deve ser maior que zero." }),

    date: z
      .string()
      .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
      .refine(isValidIsoDate, { message: "Data inválida." }),

    description: z.string().max(255).optional(),

    notes: z.string().nullable().optional(),

    recurrence: createTransactionRecurrenceSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.recurrence) return;

    const txDate = data.date;
    const startDate = data.recurrence.startDate ?? txDate;

    if (data.recurrence.endDate && data.recurrence.endDate < startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data final não pode ser anterior à data de início da recorrência.",
        path: ["recurrence", "endDate"],
      });
    }
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
      .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
      .refine(isValidIsoDate, { message: "Data inválida." })
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
    excludeHiddenAccounts: z.coerce.boolean().optional(),
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
    (data) => !data.amountOp || (data.amountMin === undefined && data.amountMax === undefined),
    {
      message: "amountOp não pode ser usado junto com amountMin/amountMax.",
      path: ["amountOp"],
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
  excludeHiddenAccounts: z.coerce.boolean().optional(),
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
  excludeHiddenAccounts: z.coerce.boolean().optional(),
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
