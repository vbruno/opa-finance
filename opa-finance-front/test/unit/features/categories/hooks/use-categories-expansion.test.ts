import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useCategoriesExpansion } from '@/features/categories/hooks/use-categories-expansion'

const makeCategory = (id: string) =>
  ({
    id,
    userId: 'u',
    name: id,
    description: null,
    type: 'expense',
    system: false,
    color: null,
    createdAt: '',
    updatedAt: '',
  }) as const

describe('useCategoriesExpansion', () => {
  it('alterna expansão de categoria', () => {
    const { result } = renderHook(() =>
      useCategoriesExpansion({
        userCategories: [makeCategory('a'), makeCategory('b')] as never,
        normalizedSearch: '',
        searchExpandIds: [],
      }),
    )

    act(() => {
      result.current.toggleCategoryExpansion('a')
    })
    expect(result.current.expandedCategoryIds).toEqual(['a'])

    act(() => {
      result.current.toggleCategoryExpansion('a')
    })
    expect(result.current.expandedCategoryIds).toEqual([])
  })

  it('expande/recolhe todas via helper', () => {
    const { result } = renderHook(() =>
      useCategoriesExpansion({
        userCategories: [makeCategory('a'), makeCategory('b')] as never,
        normalizedSearch: '',
        searchExpandIds: [],
      }),
    )

    act(() => {
      result.current.toggleExpandAll(['a', 'b'])
    })
    expect(result.current.expandedCategoryIds).toEqual(['a', 'b'])

    act(() => {
      result.current.toggleExpandAll(['a', 'b'])
    })
    expect(result.current.expandedCategoryIds).toEqual([])
  })
})
