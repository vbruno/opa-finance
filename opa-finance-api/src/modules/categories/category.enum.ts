// src/modules/categories/category.enum.ts
import { toEnumValues } from "../../core/utils/enum.utils";
import { categoryType } from "../../db/schema";

/**
 * Converte o enum do Drizzle para tupla literal do Zod
 */
export const categoryTypes = toEnumValues(categoryType.enumValues);

export type CategoryType = (typeof categoryTypes)[number];
