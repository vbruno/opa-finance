import { z } from 'zod'

import { parseCurrencyInput } from '@/lib/utils'

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

const optionalString = z
  .string()
  .transform((value) => {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  })
  .optional()

export const transferCreateSchema = z
  .object({
    fromAccountId: z.string().min(1, 'Selecione a conta de origem.'),
    toAccountId: z.string().min(1, 'Selecione a conta de destino.'),
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
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'As contas precisam ser diferentes.',
    path: ['toAccountId'],
  })

export type TransferCreateFormData = z.infer<typeof transferCreateSchema>
