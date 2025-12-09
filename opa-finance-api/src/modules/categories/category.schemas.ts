// src/modules/categories/category.schemas.ts
import { z } from "zod";
import { categoryTypes } from "./category.enum";

/* -------------------------------------------------------------------------- */
/*                               CREATE CATEGORY                               */
/* -------------------------------------------------------------------------- */

export const createCategorySchema = z.object({
  name: z.string().min(1, { message: "Nome é obrigatório." }),
  type: z.enum(categoryTypes, { message: "Tipo de categoria inválido." }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/* -------------------------------------------------------------------------- */
/*                               UPDATE CATEGORY                               */
/* -------------------------------------------------------------------------- */

export const updateCategorySchema = z
  .object({
    name: z.string().min(1, { message: "Nome é obrigatório." }).optional(),
    type: z.enum(categoryTypes, { message: "Tipo de categoria inválido." }).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/* -------------------------------------------------------------------------- */
/*                                PARAMS                                       */
/* -------------------------------------------------------------------------- */

export const categoryParamsSchema = z.object({
  id: z.uuid({ message: "ID inválido." }),
});

export type CategoryParams = z.infer<typeof categoryParamsSchema>;
