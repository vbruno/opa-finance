import { z } from 'zod'

import { ACCOUNT_TYPE_VALUES } from '@/features/accounts/model/accounts.constants'

export const accountCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe o nome da conta.')
    .max(255, 'O nome deve ter no máximo 255 caracteres.'),
  type: z
    .string()
    .min(1, 'Selecione o tipo da conta.')
    .refine(
      (value) =>
        ACCOUNT_TYPE_VALUES.includes(
          value as (typeof ACCOUNT_TYPE_VALUES)[number],
        ),
      {
        message: 'Selecione o tipo da conta.',
      },
    ),
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
    .refine(
      (value) =>
        ACCOUNT_TYPE_VALUES.includes(
          value as (typeof ACCOUNT_TYPE_VALUES)[number],
        ),
      {
        message: 'Selecione o tipo da conta.',
      },
    ),
  confirm: z.boolean().refine((value) => value, {
    message: 'Confirme os dados antes de salvar.',
  }),
})

export type AccountUpdateFormData = z.infer<typeof accountUpdateSchema>
