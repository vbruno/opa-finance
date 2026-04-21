import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { Category, Subcategory } from '@/features/categories'
import { setFormApiRootError } from '@/lib/form-api-error'
import type { CategoryCreateFormData } from '@/schemas/category.schema'
import type { SubcategoryCreateFormData } from '@/schemas/subcategory.schema'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

type UseTransactionsInlineCategoryActionsInput = {
  createCategoryModalTarget: 'create' | 'edit'
  createSubcategoryModalTarget: 'create' | 'edit'
  createCategoryId: string
  categoryCreateForm: UseFormReturn<CategoryCreateFormData>
  subcategoryCreateForm: UseFormReturn<SubcategoryCreateFormData>
  createCategory: (payload: {
    name: string
    type: string
  }) => Promise<Category>
  createSubcategory: (payload: {
    categoryId: string
    name: string
  }) => Promise<Subcategory>
  setIsCreateCategoryOpen: (open: boolean) => void
  setIsCreateSubcategoryOpen: (open: boolean) => void
  setLastCreatedSubcategory: (value: Subcategory) => void
  pendingCategorySelection: MutableRefObject<string | null>
  pendingSubcategorySelection: MutableRefObject<{
    categoryId: string
    subcategoryId: string
  } | null>
  lastCreateCategoryId: MutableRefObject<string | null>
  lastEditCategoryId: MutableRefObject<string | null>
  createCategorySelectRef: MutableRefObject<HTMLButtonElement | null>
  setCreateValue: UseFormReturn<TransactionCreateFormData>['setValue']
  setEditValue: UseFormReturn<TransactionCreateFormData>['setValue']
}

export function useTransactionsInlineCategoryActions({
  createCategoryModalTarget,
  createSubcategoryModalTarget,
  createCategoryId,
  categoryCreateForm,
  subcategoryCreateForm,
  createCategory,
  createSubcategory,
  setIsCreateCategoryOpen,
  setIsCreateSubcategoryOpen,
  setLastCreatedSubcategory,
  pendingCategorySelection,
  pendingSubcategorySelection,
  lastCreateCategoryId,
  lastEditCategoryId,
  createCategorySelectRef,
  setCreateValue,
  setEditValue,
}: UseTransactionsInlineCategoryActionsInput) {
  const onCreateCategorySubmit = useCallback(
    async (formData: CategoryCreateFormData) => {
      try {
        const created = await createCategory({
          name: formData.name,
          type: formData.type,
        })

        setIsCreateCategoryOpen(false)
        categoryCreateForm.reset()
        if (createCategoryModalTarget === 'edit') {
          lastEditCategoryId.current = created.id
          setEditValue('categoryId', created.id, {
            shouldDirty: true,
            shouldTouch: true,
          })
          setEditValue('subcategoryId', '', {
            shouldDirty: true,
            shouldTouch: true,
          })
          return
        }

        pendingCategorySelection.current = created.id
        setCreateValue('categoryId', created.id, {
          shouldDirty: true,
          shouldTouch: true,
        })
        createCategorySelectRef.current?.focus()
      } catch (error: unknown) {
        setFormApiRootError({
          error,
          setError: categoryCreateForm.setError,
          options: {
            defaultMessage: 'Erro ao criar categoria. Tente novamente.',
          },
        })
      }
    },
    [
      categoryCreateForm,
      createCategory,
      createCategoryModalTarget,
      createCategorySelectRef,
      lastEditCategoryId,
      pendingCategorySelection,
      setCreateValue,
      setEditValue,
      setIsCreateCategoryOpen,
    ],
  )

  const onCreateSubcategorySubmit = useCallback(
    async (formData: SubcategoryCreateFormData) => {
      try {
        const created = await createSubcategory({
          categoryId: formData.categoryId,
          name: formData.name,
        })

        setLastCreatedSubcategory(created)
        setIsCreateSubcategoryOpen(false)
        subcategoryCreateForm.reset()
        if (createSubcategoryModalTarget === 'edit') {
          lastEditCategoryId.current = created.categoryId
          setEditValue('categoryId', created.categoryId, {
            shouldDirty: true,
            shouldTouch: true,
          })
          setEditValue('subcategoryId', created.id, {
            shouldDirty: true,
            shouldTouch: true,
          })
          return
        }

        pendingSubcategorySelection.current = {
          categoryId: created.categoryId,
          subcategoryId: created.id,
        }
        if (createCategoryId !== created.categoryId) {
          lastCreateCategoryId.current = created.categoryId
          setCreateValue('categoryId', created.categoryId, {
            shouldDirty: true,
            shouldTouch: true,
          })
        }
        createCategorySelectRef.current?.focus()
      } catch (error: unknown) {
        setFormApiRootError({
          error,
          setError: subcategoryCreateForm.setError,
          options: {
            defaultMessage: 'Erro ao criar subcategoria. Tente novamente.',
          },
        })
      }
    },
    [
      createCategoryId,
      createCategorySelectRef,
      createSubcategory,
      createSubcategoryModalTarget,
      lastCreateCategoryId,
      lastEditCategoryId,
      pendingSubcategorySelection,
      setCreateValue,
      setEditValue,
      setIsCreateSubcategoryOpen,
      setLastCreatedSubcategory,
      subcategoryCreateForm,
    ],
  )

  return {
    submitCreateCategory: categoryCreateForm.handleSubmit(onCreateCategorySubmit),
    submitCreateSubcategory:
      subcategoryCreateForm.handleSubmit(onCreateSubcategorySubmit),
  }
}
