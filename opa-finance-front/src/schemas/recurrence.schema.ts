import { z } from 'zod'

import { RECURRENCE_POSTING_MODES } from '@/features/recurrences/model/recurrences.constants'
import { parseCurrencyInput } from '@/lib/utils'

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

const optionalTrimmedString = z
  .string()
  .transform((value) => {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  })
  .optional()

export const recurrenceFormSchema = z
  .object({
    originType: z.enum(['transaction', 'transfer']),
    postingMode: z.union([
      z.enum(RECURRENCE_POSTING_MODES, {
        message: 'Selecione o modo de lançamento.',
      }),
      z.literal(''),
    ]),
    frequency: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']),
    startDate: z
      .string()
      .min(1, 'Informe a data inicial.')
      .refine((value) => isoDateRegex.test(value), {
        message: 'Informe uma data valida (YYYY-MM-DD).',
      }),
    dayOfWeek: optionalTrimmedString,
    dayOfMonth: optionalTrimmedString,
    monthOfYear: optionalTrimmedString,
    endType: z.enum(['never', 'by_occurrences', 'until_date']),
    endOccurrences: optionalTrimmedString,
    endDate: optionalTrimmedString,
    accountId: optionalTrimmedString,
    categoryId: optionalTrimmedString,
    subcategoryId: optionalTrimmedString,
    fromAccountId: optionalTrimmedString,
    toAccountId: optionalTrimmedString,
    amount: z
      .string()
      .min(1, 'Informe o valor.')
      .refine(
        (value) => {
          const parsed = parseCurrencyInput(value)
          return parsed !== null && parsed > 0
        },
        { message: 'Informe um valor valido.' },
      ),
    description: z.string().trim().min(1, 'Informe a descrição.'),
    notes: optionalTrimmedString,
    editScope: z.enum(['all', 'this_and_next', 'single']).default('all'),
    occurrenceDate: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    const numericDayOfWeek = Number(data.dayOfWeek)
    const numericDayOfMonth = Number(data.dayOfMonth)
    const numericMonthOfYear = Number(data.monthOfYear)
    const numericEndOccurrences = Number(data.endOccurrences)

    if (!RECURRENCE_POSTING_MODES.includes(data.postingMode as (typeof RECURRENCE_POSTING_MODES)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['postingMode'],
        message: 'Selecione o modo de lançamento.',
      })
    }

    if (
      (data.frequency === 'weekly' || data.frequency === 'biweekly') &&
      (!data.dayOfWeek ||
        !Number.isInteger(numericDayOfWeek) ||
        numericDayOfWeek < 0 ||
        numericDayOfWeek > 6)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dayOfWeek'],
        message: 'Informe o dia da semana (0 a 6).',
      })
    }

    if (
      (data.frequency === 'monthly' || data.frequency === 'yearly') &&
      (!data.dayOfMonth ||
        !Number.isInteger(numericDayOfMonth) ||
        numericDayOfMonth < 1 ||
        numericDayOfMonth > 31)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dayOfMonth'],
        message: 'Informe o dia do mes (1 a 31).',
      })
    }

    if (
      data.frequency === 'yearly' &&
      (!data.monthOfYear ||
        !Number.isInteger(numericMonthOfYear) ||
        numericMonthOfYear < 1 ||
        numericMonthOfYear > 12)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['monthOfYear'],
        message: 'Informe o mes (1 a 12).',
      })
    }

    if (data.endType === 'by_occurrences') {
      if (
        !data.endOccurrences ||
        !Number.isInteger(numericEndOccurrences) ||
        numericEndOccurrences < 1
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endOccurrences'],
          message: 'Informe a quantidade de ocorrencias.',
        })
      }
    }

    if (data.endType === 'until_date') {
      if (!data.endDate || !isoDateRegex.test(data.endDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'Informe a data final.',
        })
      } else if (data.endDate < data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'Data final nao pode ser menor que a data inicial.',
        })
      }
    }

    if (data.originType === 'transaction') {
      if (!data.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accountId'],
          message: 'Selecione a conta.',
        })
      }
      if (!data.categoryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['categoryId'],
          message: 'Selecione a categoria.',
        })
      }
    } else {
      if (!data.fromAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fromAccountId'],
          message: 'Selecione a conta de origem.',
        })
      }
      if (!data.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['toAccountId'],
          message: 'Selecione a conta de destino.',
        })
      }
      if (
        data.fromAccountId &&
        data.toAccountId &&
        data.fromAccountId === data.toAccountId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['toAccountId'],
          message: 'Origem e destino devem ser diferentes.',
        })
      }
    }
  })

export type RecurrenceFormData = z.input<typeof recurrenceFormSchema>
