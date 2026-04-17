import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useWeeklyCashflowColumnsState } from '@/features/weekly-cashflow/hooks/use-weekly-cashflow-columns-state'

describe('useWeeklyCashflowColumnsState', () => {
  it('seleciona coluna e adiciona ao columnOrder', () => {
    const { result } = renderHook(() =>
      useWeeklyCashflowColumnsState({
        initialSelectedColumnIds: [],
        initialColumnOrder: [],
        initialGroups: [],
        initialGroupDisplayModes: {},
        initialSeparatorPositions: [],
        initialSortDynamicByShare: true,
      }),
    )

    act(() => {
      result.current.toggleDynamicColumn('c-1', true)
    })

    expect(result.current.selectedColumnIds).toEqual(['c-1'])
    expect(result.current.columnOrder).toEqual(['c-1'])
  })

  it('cria grupo novo e inclui item de grupo na ordem', () => {
    const { result } = renderHook(() =>
      useWeeklyCashflowColumnsState({
        initialSelectedColumnIds: ['c-1', 'c-2'],
        initialColumnOrder: ['c-1', 'c-2'],
        initialGroups: [],
        initialGroupDisplayModes: {},
        initialSeparatorPositions: [],
        initialSortDynamicByShare: true,
      }),
    )

    act(() => {
      result.current.openCreateGroupModal()
    })
    act(() => {
      result.current.setNewGroupName('Recorrentes')
      result.current.setNewGroupColumnIds(['c-1', 'c-2'])
    })
    act(() => {
      result.current.createGroup(['c-1', 'c-2'], new Map())
    })

    expect(result.current.groups).toHaveLength(1)
    expect(result.current.columnOrder.some((itemId) => itemId.startsWith('group:'))).toBe(true)
  })
})
