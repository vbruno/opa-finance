import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { useTransactionsInlineCategoryActions } from '@/features/transactions'
import type { CategoryCreateFormData } from '@/schemas/category.schema'
import type { SubcategoryCreateFormData } from '@/schemas/subcategory.schema'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

const createdCategory = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Habitação',
  description: null,
  type: 'expense' as const,
  system: false,
  color: null,
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
}

const createdSubcategory = {
  id: 'sub-1',
  userId: 'user-1',
  categoryId: 'cat-1',
  name: 'Aluguel',
  description: null,
  color: null,
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
}

describe('useTransactionsInlineCategoryActions', () => {
  it('cria categoria no fluxo de create', async () => {
    const createCategory = vi.fn().mockResolvedValue(createdCategory)
    const setCreateValue = vi.fn()
    const setIsCreateCategoryOpen = vi.fn()
    const createCategorySelectRef = {
      current: { focus: vi.fn() } as unknown as HTMLButtonElement,
    }
    const pendingCategorySelection = { current: null as string | null }

    const { result } = renderHook(() => {
      const categoryCreateForm = useForm<CategoryCreateFormData>({
        defaultValues: { name: '', type: '' },
      })
      const subcategoryCreateForm = useForm<SubcategoryCreateFormData>({
        defaultValues: { categoryId: '', name: '' },
      })
      return useTransactionsInlineCategoryActions({
        createCategoryModalTarget: 'create',
        createSubcategoryModalTarget: 'create',
        createCategoryId: '',
        categoryCreateForm,
        subcategoryCreateForm,
        createCategory,
        createSubcategory: vi.fn(),
        setIsCreateCategoryOpen,
        setIsCreateSubcategoryOpen: vi.fn(),
        setLastCreatedSubcategory: vi.fn(),
        pendingCategorySelection,
        pendingSubcategorySelection: {
          current: null,
        },
        lastCreateCategoryId: {
          current: null,
        },
        lastEditCategoryId: {
          current: null,
        },
        createCategorySelectRef,
        setCreateValue: setCreateValue as unknown as ReturnType<
          typeof useForm<TransactionCreateFormData>
        >['setValue'],
        setEditValue: vi.fn() as unknown as ReturnType<
          typeof useForm<TransactionCreateFormData>
        >['setValue'],
      })
    })

    await act(async () => {
      await result.current.submitCreateCategory()
    })

    expect(createCategory).toHaveBeenCalledWith({
      name: '',
      type: '',
    })
    expect(setIsCreateCategoryOpen).toHaveBeenCalledWith(false)
    expect(pendingCategorySelection.current).toBe('cat-1')
    expect(setCreateValue).toHaveBeenCalledWith('categoryId', 'cat-1', {
      shouldDirty: true,
      shouldTouch: true,
    })
  })

  it('cria subcategoria no fluxo de edit', async () => {
    const createSubcategory = vi.fn().mockResolvedValue(createdSubcategory)
    const setEditValue = vi.fn()
    const setLastCreatedSubcategory = vi.fn()
    const lastEditCategoryId = { current: null as string | null }

    const { result } = renderHook(() => {
      const categoryCreateForm = useForm<CategoryCreateFormData>({
        defaultValues: { name: '', type: '' },
      })
      const subcategoryCreateForm = useForm<SubcategoryCreateFormData>({
        defaultValues: { categoryId: 'cat-1', name: 'Aluguel' },
      })
      return useTransactionsInlineCategoryActions({
        createCategoryModalTarget: 'create',
        createSubcategoryModalTarget: 'edit',
        createCategoryId: 'cat-1',
        categoryCreateForm,
        subcategoryCreateForm,
        createCategory: vi.fn(),
        createSubcategory,
        setIsCreateCategoryOpen: vi.fn(),
        setIsCreateSubcategoryOpen: vi.fn(),
        setLastCreatedSubcategory,
        pendingCategorySelection: {
          current: null,
        },
        pendingSubcategorySelection: {
          current: null,
        },
        lastCreateCategoryId: {
          current: null,
        },
        lastEditCategoryId,
        createCategorySelectRef: { current: null },
        setCreateValue: vi.fn() as unknown as ReturnType<
          typeof useForm<TransactionCreateFormData>
        >['setValue'],
        setEditValue: setEditValue as unknown as ReturnType<
          typeof useForm<TransactionCreateFormData>
        >['setValue'],
      })
    })

    await act(async () => {
      await result.current.submitCreateSubcategory()
    })

    expect(setLastCreatedSubcategory).toHaveBeenCalledWith(createdSubcategory)
    expect(lastEditCategoryId.current).toBe('cat-1')
    expect(setEditValue).toHaveBeenCalledWith('categoryId', 'cat-1', {
      shouldDirty: true,
      shouldTouch: true,
    })
    expect(setEditValue).toHaveBeenCalledWith('subcategoryId', 'sub-1', {
      shouldDirty: true,
      shouldTouch: true,
    })
  })
})
