import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useTransactionsDeleteActions } from '@/features/transactions'
import type { Transaction } from '@/features/transactions/transactions.api'

const transaction: Transaction = {
  id: 'tx-1',
  userId: 'user-1',
  accountId: 'acc-1',
  accountName: 'Conta A',
  categoryId: 'cat-1',
  categoryName: 'Habitação',
  subcategoryId: null,
  subcategoryName: null,
  type: 'expense',
  amount: 10,
  date: '2026-04-21',
  description: 'Teste',
  notes: null,
  transferId: null,
  createdAt: '2026-04-21T00:00:00.000Z',
}

describe('useTransactionsDeleteActions', () => {
  it('abre confirmação de exclusão e limpa erro', () => {
    const setSelectedTransaction = vi.fn()
    const setIsDeleteConfirmOpen = vi.fn()

    const { result } = renderHook(() =>
      useTransactionsDeleteActions({
        isDeleteConfirmOpen: false,
        selectedTransaction: null,
        selectedTransactions: [],
        getBulkDeleteIds: vi.fn(),
        deleteTransaction: vi.fn(),
        clearSelection: vi.fn(),
        setSelectedTransaction,
        setIsDeleteConfirmOpen,
        setIsBulkDeleteOpen: vi.fn(),
      }),
    )

    act(() => {
      result.current.openDeleteConfirm(transaction)
    })

    expect(setSelectedTransaction).toHaveBeenCalledWith(transaction)
    expect(setIsDeleteConfirmOpen).toHaveBeenCalledWith(true)
    expect(result.current.deleteError).toBeNull()
  })

  it('executa delete individual com sucesso', async () => {
    const deleteTransaction = vi.fn().mockResolvedValue(undefined)
    const setSelectedTransaction = vi.fn()
    const setIsDeleteConfirmOpen = vi.fn()

    const { result } = renderHook(() =>
      useTransactionsDeleteActions({
        isDeleteConfirmOpen: true,
        selectedTransaction: transaction,
        selectedTransactions: [],
        getBulkDeleteIds: vi.fn(),
        deleteTransaction,
        clearSelection: vi.fn(),
        setSelectedTransaction,
        setIsDeleteConfirmOpen,
        setIsBulkDeleteOpen: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.submitDeleteSelectedTransaction()
    })

    expect(deleteTransaction).toHaveBeenCalledWith('tx-1')
    expect(setIsDeleteConfirmOpen).toHaveBeenCalledWith(false)
    expect(setSelectedTransaction).toHaveBeenCalledWith(null)
  })

  it('retorna erro em falha no delete individual', async () => {
    const { result } = renderHook(() =>
      useTransactionsDeleteActions({
        isDeleteConfirmOpen: true,
        selectedTransaction: transaction,
        selectedTransactions: [],
        getBulkDeleteIds: vi.fn(),
        deleteTransaction: vi.fn().mockRejectedValue(new Error('network')),
        clearSelection: vi.fn(),
        setSelectedTransaction: vi.fn(),
        setIsDeleteConfirmOpen: vi.fn(),
        setIsBulkDeleteOpen: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.submitDeleteSelectedTransaction()
    })

    expect(result.current.deleteError).toBe(
      'Erro ao excluir transação. Tente novamente.',
    )
  })

  it('executa delete em lote e limpa seleção quando sucesso', async () => {
    const clearSelection = vi.fn()
    const setIsBulkDeleteOpen = vi.fn()
    const deleteTransaction = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useTransactionsDeleteActions({
        isDeleteConfirmOpen: false,
        selectedTransaction: null,
        selectedTransactions: [transaction],
        getBulkDeleteIds: () => ['tx-1'],
        deleteTransaction,
        clearSelection,
        setSelectedTransaction: vi.fn(),
        setIsDeleteConfirmOpen: vi.fn(),
        setIsBulkDeleteOpen,
      }),
    )

    await act(async () => {
      await result.current.submitBulkDelete()
    })

    expect(deleteTransaction).toHaveBeenCalledWith('tx-1')
    expect(setIsBulkDeleteOpen).toHaveBeenCalledWith(false)
    expect(clearSelection).toHaveBeenCalled()
  })

  it('aplica erro em lote quando há rejeição parcial', async () => {
    const { result } = renderHook(() =>
      useTransactionsDeleteActions({
        isDeleteConfirmOpen: false,
        selectedTransaction: null,
        selectedTransactions: [transaction],
        getBulkDeleteIds: () => ['tx-1', 'tx-2'],
        deleteTransaction: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('failed')),
        clearSelection: vi.fn(),
        setSelectedTransaction: vi.fn(),
        setIsDeleteConfirmOpen: vi.fn(),
        setIsBulkDeleteOpen: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.submitBulkDelete()
    })

    expect(result.current.bulkDeleteError).toBe(
      'Erro ao excluir transações. Tente novamente.',
    )
  })
})
