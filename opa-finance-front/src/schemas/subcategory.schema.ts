import { z } from 'zod'

export const subcategoryCreateSchema = z.object({
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
  name: z
    .string()
    .min(1, 'Informe o nome da subcategoria.')
    .max(255, 'O nome deve ter no máximo 255 caracteres.'),
})

export type SubcategoryCreateFormData = z.infer<typeof subcategoryCreateSchema>

export const subcategoryUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe o nome da subcategoria.')
    .max(255, 'O nome deve ter no máximo 255 caracteres.'),
})

export type SubcategoryUpdateFormData = z.infer<typeof subcategoryUpdateSchema>
