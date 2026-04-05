// src/modules/transfers/transfer.schemas.ts
import { z } from "zod";
import { ISO_DATE_REGEX, isValidIsoDate } from "../../core/utils/recurrence-schedule.utils";

const recurrenceFrequencySchema = z.enum(["weekly", "biweekly", "monthly", "yearly"]);
const recurrenceEndTypeSchema = z.enum(["never", "by_occurrences", "until_date"]);

const createTransferRecurrenceSchema = z
  .object({
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

export const createTransferSchema = z
  .object({
    fromAccountId: z.uuid({ message: "Conta de origem inválida." }),
    toAccountId: z.uuid({ message: "Conta de destino inválida." }),
    amount: z.coerce.number().positive("Valor deve ser maior que zero."),
    date: z
      .string()
      .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.")
      .refine(isValidIsoDate, { message: "Data inválida." }),
    description: z.string().max(255).optional(),
    recurrence: createTransferRecurrenceSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.recurrence) return;

    const effectiveStartDate = data.recurrence.startDate ?? data.date;
    if (data.recurrence.endDate && data.recurrence.endDate < effectiveStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data final não pode ser anterior à data de início da recorrência.",
        path: ["recurrence", "endDate"],
      });
    }
  });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
