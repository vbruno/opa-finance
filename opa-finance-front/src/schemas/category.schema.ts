import { z } from 'zod'

const categoryTypes = ['income', 'expense'] as const

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe o nome da categoria.')
    .max(255, 'O nome deve ter no máximo 255 caracteres.'),
  type: z
    .string()
    .min(1, 'Selecione o tipo da categoria.')
    .refine(
      (value) => categoryTypes.includes(value as (typeof categoryTypes)[number]),
      {
        message: 'Selecione o tipo da categoria.',
      },
    ),
})

export type CategoryCreateFormData = z.infer<typeof categoryCreateSchema>
