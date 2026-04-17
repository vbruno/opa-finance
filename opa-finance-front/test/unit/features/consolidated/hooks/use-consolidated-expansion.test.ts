import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useConsolidatedExpansion } from '@/features/consolidated/hooks/use-consolidated-expansion'

describe('useConsolidatedExpansion', () => {
  it('deve iniciar recolhido e permitir expandir/recolher tudo', () => {
    const { result } = renderHook(() =>
      useConsolidatedExpansion(['cat-1', 'cat-2']),
    )

    expect(result.current.areAllCollapsed).toBe(true)

    act(() => {
      result.current.expandAll()
    })
    expect(result.current.areAllCollapsed).toBe(false)

    act(() => {
      result.current.collapseAll()
    })
    expect(result.current.areAllCollapsed).toBe(true)
  })
})
