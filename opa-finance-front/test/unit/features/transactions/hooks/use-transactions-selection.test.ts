import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useTransactionsSelection } from '@/features/transactions'
import type { Transaction } from '@/features/transactions'

function makeTransaction(
  id: string,
  amount: number,
  type: 'income' | 'expense',
  transferId: string | null = null,
): Transaction {
  return {
    id,
    userId: 'user-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    subcategoryId: null,
    type,
    amount,
    date: '2026-04-12',
    description: 'desc',
    notes: null,
    transferId,
    createdAt: '2026-04-12T00:00:00.000Z',
  }
}

describe('useTransactionsSelection', () => {
  it('deve alternar seleção individual e limpar seleção', () => {
    const transactions = [
      makeTransaction('t1', 100, 'income'),
      makeTransaction('t2', 50, 'expense'),
    ]
    const { result } = renderHook(() =>
      useTransactionsSelection({ transactions }),
    )

    expect(result.current.selectedCount).toBe(0)

    act(() => {
      result.current.toggleTransactionSelection('t1')
    })

    expect(result.current.selectedIds.has('t1')).toBe(true)
    expect(result.current.selectedCount).toBe(1)

    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.selectedCount).toBe(0)
  })

  it('deve selecionar todos e calcular totais corretamente', () => {
    const transactions = [
      makeTransaction('t1', 200, 'income'),
      makeTransaction('t2', 50, 'expense'),
      makeTransaction('t3', 30, 'expense'),
    ]
    const { result } = renderHook(() =>
      useTransactionsSelection({ transactions }),
    )

    act(() => {
      result.current.selectAllOnPage()
    })

    expect(result.current.allSelected).toBe(true)
    expect(result.current.selectedCount).toBe(3)
    expect(result.current.selectedTotal).toBe(120)
    expect(result.current.selectedAverage).toBe(40)
  })

  it('deve remover seleção que não existe mais após troca de página', () => {
    const firstPage = [
      makeTransaction('t1', 100, 'income'),
      makeTransaction('t2', 10, 'expense'),
    ]
    const secondPage = [makeTransaction('t3', 80, 'income')]

    const { result, rerender } = renderHook(
      ({ transactions }) => useTransactionsSelection({ transactions }),
      { initialProps: { transactions: firstPage } },
    )

    act(() => {
      result.current.toggleTransactionSelection('t1')
      result.current.toggleTransactionSelection('t2')
    })
    expect(result.current.selectedCount).toBe(2)

    rerender({ transactions: secondPage })

    expect(result.current.selectedCount).toBe(0)
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('deve deduplicar transferências no getBulkDeleteIds', () => {
    const transferA = 'tr-a'
    const items = [
      makeTransaction('t-expense', 100, 'expense', transferA),
      makeTransaction('t-income', 100, 'income', transferA),
      makeTransaction('t-normal', 30, 'expense', null),
    ]
    const { result } = renderHook(() =>
      useTransactionsSelection({ transactions: items }),
    )

    const ids = result.current.getBulkDeleteIds(items)
    expect(ids).toHaveLength(2)
    expect(ids).toContain('t-normal')
    expect(ids.some((id) => id === 't-expense' || id === 't-income')).toBe(true)
  })
})
