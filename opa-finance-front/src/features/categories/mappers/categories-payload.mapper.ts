import type {
  CategoryCreatePayload,
  CategoryUpdatePayload,
  SubcategoryCreatePayload,
  SubcategoryUpdatePayload,
} from '@/features/categories/categories.api'
import { normalizeOptionalDescription } from '@/features/categories/model/categories.helpers'
import type {
  CategoryCreateFormData,
  CategoryUpdateFormData,
} from '@/schemas/category.schema'
import type {
  SubcategoryCreateFormData,
  SubcategoryUpdateFormData,
} from '@/schemas/subcategory.schema'

export function mapCreateCategoryPayload(
  formData: CategoryCreateFormData,
): CategoryCreatePayload {
  return {
    name: formData.name,
    type: formData.type,
    description: normalizeOptionalDescription(formData.description),
  }
}

export function mapUpdateCategoryPayload(
  id: string,
  formData: CategoryUpdateFormData,
): CategoryUpdatePayload {
  return {
    id,
    name: formData.name,
    description: normalizeOptionalDescription(formData.description),
  }
}

export function mapCreateSubcategoryPayload(
  categoryId: string,
  formData: SubcategoryCreateFormData,
): SubcategoryCreatePayload {
  return {
    categoryId,
    name: formData.name,
    description: normalizeOptionalDescription(formData.description),
  }
}

export function mapUpdateSubcategoryPayload(
  id: string,
  categoryId: string,
  formData: SubcategoryUpdateFormData,
): SubcategoryUpdatePayload {
  return {
    id,
    categoryId,
    name: formData.name,
    description: normalizeOptionalDescription(formData.description),
  }
}
