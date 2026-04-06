import { z } from "zod";
import { ISO_DATE_REGEX, isValidIsoDate } from "../../core/utils/recurrence-schedule.utils";

export const recurrenceOriginTypeSchema = z.enum(["transaction", "transfer"]);
export const recurrenceFrequencySchema = z.enum(["weekly", "biweekly", "monthly", "yearly"]);
export const recurrenceEndTypeSchema = z.enum(["never", "by_occurrences", "until_date"]);
export const recurrenceStatusSchema = z.enum(["active", "finalized"]);

export const createRecurrenceSchema = z
  .object({
    originType: recurrenceOriginTypeSchema,
    frequency: recurrenceFrequencySchema,
    startDate: z
      .string()
      .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
      .refine(isValidIsoDate, { message: "Data inválida." }),
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
    accountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    subcategoryId: z.uuid().optional(),
    fromAccountId: z.uuid().optional(),
    toAccountId: z.uuid().optional(),
    amount: z.number().positive("Valor deve ser maior que zero."),
    description: z.string().max(255).optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.originType === "transaction") {
      if (!data.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conta é obrigatória para recorrência de transação.",
          path: ["accountId"],
        });
      }
      if (!data.categoryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Categoria é obrigatória para recorrência de transação.",
          path: ["categoryId"],
        });
      }
      if (data.fromAccountId !== undefined || data.toAccountId !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Recorrência de transação não aceita contas de transferência.",
          path: ["fromAccountId"],
        });
      }
    }

    if (data.originType === "transfer") {
      if (!data.fromAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conta de origem é obrigatória para recorrência de transferência.",
          path: ["fromAccountId"],
        });
      }
      if (!data.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conta de destino é obrigatória para recorrência de transferência.",
          path: ["toAccountId"],
        });
      }
      if (data.fromAccountId && data.toAccountId && data.fromAccountId === data.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conta de origem e destino devem ser diferentes.",
          path: ["toAccountId"],
        });
      }
      if (
        data.accountId !== undefined ||
        data.categoryId !== undefined ||
        data.subcategoryId !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Recorrência de transferência não aceita conta/categoria/subcategoria de transação.",
          path: ["accountId"],
        });
      }
    }

    if (data.frequency === "weekly" || data.frequency === "biweekly") {
      if (data.dayOfWeek === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dia da semana é obrigatório para frequência semanal/quinzenal.",
          path: ["dayOfWeek"],
        });
      }
    }

    if (data.frequency === "monthly") {
      if (data.dayOfMonth === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dia do mês é obrigatório para frequência mensal.",
          path: ["dayOfMonth"],
        });
      }
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

    if (data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data final não pode ser anterior à data de início.",
        path: ["endDate"],
      });
    }
  });

export const updateRecurrenceSchema = createRecurrenceSchema
  .partial()
  .extend({
    expectedVersion: z.number().int().positive().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export const recurrenceParamsSchema = z.object({
  id: z.uuid(),
});

export const listRecurrencesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  originType: recurrenceOriginTypeSchema.optional(),
  status: recurrenceStatusSchema.optional(),
  frequency: recurrenceFrequencySchema.optional(),
  accountId: z.uuid().optional(),
  q: z.string().max(100).optional(),
});

export const materializeRecurrencesSchema = z.object({
  untilDate: z
    .string()
    .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
    .refine(isValidIsoDate, { message: "Data inválida." })
    .optional(),
  maxRecurrences: z.number().int().min(1).max(500).optional(),
});

export const recurrenceEditScopeSchema = z.enum(["single", "this_and_next", "all"]);

const recurrenceForecastAccountIdsSchema = z
  .preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") {
        return [];
      }

      if (Array.isArray(value)) {
        return value.flatMap((item) =>
          typeof item === "string"
            ? item
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
            : [],
        );
      }

      if (typeof value === "string") {
        return value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      }

      return [];
    },
    z.array(z.string().uuid({ message: "ID de conta inválido." })).default([]),
  )
  .transform((ids) => Array.from(new Set(ids)));

export const recurrencesForecastQuerySchema = z.object({
  year: z.coerce
    .number()
    .int({ message: "Ano inválido." })
    .min(2000, { message: "Ano inválido." })
    .max(2100, { message: "Ano inválido." })
    .optional(),
  accountIds: recurrenceForecastAccountIdsSchema,
});

export const editRecurrenceByScopeSchema = z
  .object({
    scope: recurrenceEditScopeSchema,
    occurrenceDate: z
      .string()
      .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
      .refine(isValidIsoDate, { message: "Data inválida." })
      .optional(),
    changes: updateRecurrenceSchema,
  })
  .superRefine((data, ctx) => {
    if (data.scope !== "all" && !data.occurrenceDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data da ocorrência é obrigatória para este escopo.",
        path: ["occurrenceDate"],
      });
    }
  });

export type CreateRecurrenceInput = z.infer<typeof createRecurrenceSchema>;
export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>;
export type RecurrenceParams = z.infer<typeof recurrenceParamsSchema>;
export type ListRecurrencesQuery = z.infer<typeof listRecurrencesQuerySchema>;
export type MaterializeRecurrencesInput = z.infer<typeof materializeRecurrencesSchema>;
export type EditRecurrenceByScopeInput = z.infer<typeof editRecurrenceByScopeSchema>;
export type RecurrenceEditScope = z.infer<typeof recurrenceEditScopeSchema>;
export type RecurrencesForecastQuery = z.infer<typeof recurrencesForecastQuerySchema>;
