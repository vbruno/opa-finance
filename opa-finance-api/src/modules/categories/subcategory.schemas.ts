// src/modules/categories/subcategory.schemas.ts
import { z } from "zod";

export const createSubcategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
});

export const updateSubcategorySchema = z
  .object({
    name: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export const subcategoryParamsSchema = z.object({
  id: z.string().uuid(),
});
