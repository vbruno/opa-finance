import { z } from 'zod'

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
  confirm: z.boolean().refine((value) => value, {
    message: 'Confirme os dados antes de criar a conta.',
  }),
})

export type AccountCreateFormData = z.infer<typeof accountCreateSchema>

export const accountUpdateSchema = z.object({
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
  confirm: z.boolean().refine((value) => value, {
    message: 'Confirme os dados antes de salvar.',
  }),
})

export type AccountUpdateFormData = z.infer<typeof accountUpdateSchema>
