import { z } from 'zod'

import { parseCurrencyInput } from '@/lib/utils'

const accountTypes = [
  'cash',
  'checking_account',
  'savings_account',
  'credit_card',
  'investment',
] as const

export const accountCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe o nome da conta.')
    .max(255, 'O nome deve ter no máximo 255 caracteres.'),
  type: z
    .string()
    .min(1, 'Selecione o tipo da conta.')
    .refine((value) => accountTypes.includes(value as typeof accountTypes[number]), {
      message: 'Selecione o tipo da conta.',
    }),
  currentBalance: z
    .string()
    .min(1, 'Informe o saldo atual.')
    .refine((value) => {
      const parsed = parseCurrencyInput(value)
      return parsed !== null && !Number.isNaN(parsed)
    }, {
      message: 'Informe um saldo válido.',
    }),
  confirm: z.boolean().refine((value) => value, {
    message: 'Confirme os dados antes de criar a conta.',
  }),
})

export type AccountCreateFormData = z.infer<typeof accountCreateSchema>
