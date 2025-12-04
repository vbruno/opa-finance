// src/modules/categories/category.schemas.ts
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["income", "expense"]),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.enum(["income", "expense"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export const categoryParamsSchema = z.object({
  id: z.string().uuid(),
});
