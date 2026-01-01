import { z } from 'zod'

import { parseCurrencyInput } from '@/lib/utils'

const transactionTypes = ['income', 'expense'] as const
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

const optionalString = z
  .string()
  .transform((value) => {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  })
  .optional()

export const transactionCreateSchema = z.object({
  accountId: z.string().min(1, 'Selecione a conta.'),
  categoryId: z.string().min(1, 'Selecione a categoria.'),
  subcategoryId: optionalString,
  type: z
    .string()
    .min(1, 'Selecione o tipo da transacao.')
    .refine(
      (value) =>
        transactionTypes.includes(
          value as (typeof transactionTypes)[number],
        ),
      {
        message: 'Selecione o tipo da transacao.',
      },
    ),
  amount: z
    .string()
    .min(1, 'Informe o valor.')
    .refine((value) => {
      const parsed = parseCurrencyInput(value)
      return parsed !== null && !Number.isNaN(parsed) && parsed > 0
    }, {
      message: 'Informe um valor valido.',
    }),
  date: z
    .string()
    .min(1, 'Informe a data.')
    .refine((value) => isoDateRegex.test(value), {
      message: 'Informe uma data valida.',
    }),
  description: optionalString,
  notes: optionalString,
})

export type TransactionCreateFormData = z.infer<typeof transactionCreateSchema>

export const transactionUpdateSchema = transactionCreateSchema

export type TransactionUpdateFormData = z.infer<typeof transactionUpdateSchema>
