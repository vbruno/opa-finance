import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useDashboardPanels } from '@/features/dashboard/hooks/use-dashboard-panels'

describe('useDashboardPanels', () => {
  it('deve alternar abertura dos blocos', () => {
    const { result } = renderHook(() => useDashboardPanels())

    expect(result.current.isTransactionsOpen).toBe(true)
    expect(result.current.isTopExpensesOpen).toBe(false)
    expect(result.current.isTopIncomeOpen).toBe(false)

    act(() => {
      result.current.toggleTransactionsOpen()
      result.current.toggleTopExpensesOpen()
      result.current.toggleTopIncomeOpen()
    })

    expect(result.current.isTransactionsOpen).toBe(false)
    expect(result.current.isTopExpensesOpen).toBe(true)
    expect(result.current.isTopIncomeOpen).toBe(true)
  })

  it('deve alternar groupBy por checkbox', () => {
    const { result } = renderHook(() => useDashboardPanels())

    act(() => {
      result.current.updateExpenseGroupBy(true)
      result.current.updateIncomeGroupBy(true)
    })

    expect(result.current.expenseGroupBy).toBe('subcategory')
    expect(result.current.incomeGroupBy).toBe('subcategory')

    act(() => {
      result.current.updateExpenseGroupBy(false)
      result.current.updateIncomeGroupBy(false)
    })

    expect(result.current.expenseGroupBy).toBe('category')
    expect(result.current.incomeGroupBy).toBe('category')
  })

  it('deve aplicar fallback para category quando item de subcategoria representa categoria pai', () => {
    const { result } = renderHook(() => useDashboardPanels())

    act(() => {
      result.current.updateExpenseGroupBy(true)
      result.current.selectExpenseTopCategory({
        id: 'cat-1',
        name: 'Alimentação',
        totalAmount: 100,
        percentage: 50,
        categoryName: 'Alimentação',
      })
    })

    expect(result.current.selectedTopCategory).toMatchObject({
      id: 'cat-1',
      groupBy: 'category',
      type: 'expense',
    })
  })
})
