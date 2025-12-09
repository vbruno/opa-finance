// src/modules/categories/subcategory.schemas.ts
import { z } from "zod";

// Regex para validar HEX (#RGB ou #RRGGBB)
const hexColorRegex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const createSubcategorySchema = z.object({
  categoryId: z.uuid({ message: "ID da categoria inválido." }),
  name: z.string().min(1, { message: "Nome é obrigatório." }),
  color: z
    .string()
    .regex(hexColorRegex, { message: "Cor inválida. Use formato HEX (#FFF ou #FFFFFF)." })
    .optional(),
});

export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;

export const updateSubcategorySchema = z
  .object({
    name: z.string().min(1, { message: "Nome é obrigatório." }).optional(),
    color: z
      .string()
      .regex(hexColorRegex, { message: "Cor inválida. Use formato HEX (#FFF ou #FFFFFF)." })
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>;

export const subcategoryParamsSchema = z.object({
  id: z.uuid({ message: "ID inválido." }),
});

export type SubcategoryParams = z.infer<typeof subcategoryParamsSchema>;
