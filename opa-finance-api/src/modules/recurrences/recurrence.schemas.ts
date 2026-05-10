import { z } from "zod";
import { ISO_DATE_REGEX, isValidIsoDate } from "../../core/utils/recurrence-schedule.utils";

export const recurrenceOriginTypeSchema = z.enum(["transaction", "transfer"]);
export const recurrenceFrequencySchema = z.enum(["weekly", "biweekly", "monthly", "yearly"]);
export const recurrenceEndTypeSchema = z.enum(["never", "by_occurrences", "until_date"]);
export const recurrenceStatusSchema = z.enum(["active", "finalized"]);
export const recurrencePostingModeSchema = z.enum(["automatic", "review_required"]);

export const createRecurrenceSchema = z
  .object({
    originType: recurrenceOriginTypeSchema,
    postingMode: recurrencePostingModeSchema.default("automatic"),
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

const optionalDateSchema = z
  .string()
  .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
  .refine(isValidIsoDate, { message: "Data inválida." })
  .optional();

export const updateRecurrenceSchema = z
  .object({
    originType: z
      .never({ message: "Não é permitido alterar o tipo de origem da recorrência." })
      .optional(),
    postingMode: recurrencePostingModeSchema.optional(),
    frequency: recurrenceFrequencySchema.optional(),
    startDate: optionalDateSchema,
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    monthOfYear: z.number().int().min(1).max(12).optional(),
    endType: recurrenceEndTypeSchema.optional(),
    endOccurrences: z.number().int().min(1).optional(),
    endDate: optionalDateSchema,
    accountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    subcategoryId: z.uuid().nullable().optional(),
    fromAccountId: z.uuid().optional(),
    toAccountId: z.uuid().optional(),
    amount: z.number().positive("Valor deve ser maior que zero.").optional(),
    description: z.string().max(255).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.frequency === "weekly" || data.frequency === "biweekly") {
      if (data.dayOfWeek === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dia da semana é obrigatório para frequência semanal/quinzenal.",
          path: ["dayOfWeek"],
        });
      }
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

    // Valida apenas quando ambos os campos vêm no payload. O caso parcial
    // (endDate sem startDate, comparado contra existing.startDate) é coberto
    // em RecurrenceEditService.update — REC-REV-010.
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data final não pode ser anterior à data de início.",
        path: ["endDate"],
      });
    }
  })
  .refine(
    (data) =>
      Object.entries(data).some(([key, value]) => key !== "expectedVersion" && value !== undefined),
    {
      message: "Pelo menos um campo deve ser atualizado.",
    },
  );

export const recurrenceParamsSchema = z.object({
  id: z.uuid(),
});

export const deleteOccurrenceOverrideParamsSchema = z.object({
  id: z.uuid(),
  date: z.string().regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.").refine(isValidIsoDate, {
    message: "Data inválida.",
  }),
});

export const listRecurrencesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  originType: recurrenceOriginTypeSchema.optional(),
  status: recurrenceStatusSchema.optional(),
  frequency: recurrenceFrequencySchema.optional(),
  postingMode: recurrencePostingModeSchema.optional(),
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
  recurrenceId: z.uuid().optional(),
});

const timelineIncludeProjectedSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }

  return value;
}, z.boolean().optional().default(true));

export const recurrenceTimelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(120).default(12),
  page: z.coerce.number().int().min(1).default(1),
  dir: z.enum(["asc", "desc"]).default("asc"),
  untilDate: z
    .string()
    .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
    .refine(isValidIsoDate, { message: "Data inválida." })
    .optional(),
  includeProjected: timelineIncludeProjectedSchema,
});

export const recurrenceOccurrenceParamsSchema = z.object({
  id: z.uuid(),
});

export const recurrenceOccurrenceReviewPayloadSchema = z.object({
  occurrenceDate: z
    .string()
    .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
    .refine(isValidIsoDate, { message: "Data inválida." }),
  originalScheduledDate: z
    .string()
    .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
    .refine(isValidIsoDate, { message: "Data inválida." }),
  originType: recurrenceOriginTypeSchema,
  amount: z.number().positive("Valor deve ser maior que zero."),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  accountId: z.uuid().nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  subcategoryId: z.uuid().nullable().optional(),
  fromAccountId: z.uuid().nullable().optional(),
  toAccountId: z.uuid().nullable().optional(),
});

export const confirmRecurrenceOccurrenceSchema = z.object({
  expectedVersion: z.number().int().positive(),
  occurrenceDate: z
    .string()
    .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
    .refine(isValidIsoDate, { message: "Data inválida." })
    .optional(),
  amount: z.number().positive("Valor deve ser maior que zero.").optional(),
  description: z.string().max(255).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  accountId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  subcategoryId: z.uuid().nullable().optional(),
  fromAccountId: z.uuid().optional(),
  toAccountId: z.uuid().optional(),
});

export const recurrenceAnticipateSchema = z.object({
  occurrenceDate: z
    .string()
    .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
    .refine(isValidIsoDate, { message: "Data inválida." }),
  amount: z.number().positive("Valor deve ser maior que zero.").optional(),
  description: z.string().max(255).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  accountId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  subcategoryId: z.uuid().nullable().optional(),
  fromAccountId: z.uuid().optional(),
  toAccountId: z.uuid().optional(),
});

export const skipRecurrenceOccurrenceSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
});

export const upsertOccurrenceOverrideSchema = z
  .object({
    occurrenceDate: z
      .string()
      .regex(ISO_DATE_REGEX, "Data inválida. Use YYYY-MM-DD.")
      .refine(isValidIsoDate, { message: "Data inválida." }),
    amount: z.number().positive("Valor deve ser maior que zero.").optional(),
    description: z.string().max(255).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (data) =>
      data.amount !== undefined || data.description !== undefined || data.notes !== undefined,
    {
      message: "Informe ao menos um campo para sobrescrever.",
    },
  );

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
export type DeleteOccurrenceOverrideParams = z.infer<typeof deleteOccurrenceOverrideParamsSchema>;
export type RecurrenceOccurrenceParams = z.infer<typeof recurrenceOccurrenceParamsSchema>;
export type RecurrenceOccurrenceReviewPayload = z.infer<
  typeof recurrenceOccurrenceReviewPayloadSchema
>;
export type ConfirmRecurrenceOccurrenceInput = z.infer<typeof confirmRecurrenceOccurrenceSchema>;
export type SkipRecurrenceOccurrenceInput = z.infer<typeof skipRecurrenceOccurrenceSchema>;
export type RecurrenceAnticipateInput = z.infer<typeof recurrenceAnticipateSchema>;
export type UpsertOccurrenceOverrideInput = z.infer<typeof upsertOccurrenceOverrideSchema>;
export type RecurrenceTimelineQuery = z.infer<typeof recurrenceTimelineQuerySchema>;
export type ListRecurrencesQuery = z.infer<typeof listRecurrencesQuerySchema>;
export type MaterializeRecurrencesInput = z.infer<typeof materializeRecurrencesSchema>;
export type EditRecurrenceByScopeInput = z.infer<typeof editRecurrenceByScopeSchema>;
export type RecurrenceEditScope = z.infer<typeof recurrenceEditScopeSchema>;
export type RecurrencesForecastQuery = z.infer<typeof recurrencesForecastQuerySchema>;
