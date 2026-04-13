import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useTransferForm } from '@/features/transactions'
import type { Transaction } from '@/features/transactions/transactions.api'

const transferExpense: Transaction = {
  id: 'tx-exp',
  userId: 'user-1',
  accountId: 'acc-1',
  accountName: 'Conta A',
  categoryId: 'cat-1',
  categoryName: 'Transferência',
  subcategoryId: null,
  subcategoryName: null,
  type: 'expense',
  amount: 100,
  date: '2026-04-13',
  description: 'Transfer',
  notes: null,
  transferId: 'tr-1',
  createdAt: '2026-04-13T00:00:00.000Z',
}

const transferIncome: Transaction = {
  ...transferExpense,
  id: 'tx-inc',
  accountId: 'acc-2',
  accountName: 'Conta B',
  type: 'income',
}

describe('useTransferForm', () => {
  it('deve abrir modal de transferência nova', () => {
    const onTransferModalOpen = vi.fn()
    const hook = renderHook(() =>
      useTransferForm({
        isTransferOpen: false,
        primaryAccountId: 'acc-1',
        defaultTransferToAccountId: 'acc-2',
        transactions: [],
        createTransfer: vi.fn(),
        updateTransaction: vi.fn(),
        onTransferModalOpen,
        onTransferModalClose: vi.fn(),
        onTransactionDetailsClose: vi.fn(),
      }),
    )

    act(() => {
      hook.result.current.openTransferCreate()
    })

    expect(onTransferModalOpen).toHaveBeenCalledTimes(1)
  })

  it('deve inverter contas de origem/destino', () => {
    const hook = renderHook(() =>
      useTransferForm({
        isTransferOpen: false,
        primaryAccountId: 'acc-1',
        defaultTransferToAccountId: 'acc-2',
        transactions: [],
        createTransfer: vi.fn(),
        updateTransaction: vi.fn(),
        onTransferModalOpen: vi.fn(),
        onTransferModalClose: vi.fn(),
        onTransactionDetailsClose: vi.fn(),
      }),
    )

    act(() => {
      hook.result.current.transferForm.setValue('fromAccountId', 'acc-1')
      hook.result.current.transferForm.setValue('toAccountId', 'acc-2')
      hook.result.current.handleSwapTransferAccounts()
    })

    expect(hook.result.current.transferForm.getValues('fromAccountId')).toBe('acc-2')
    expect(hook.result.current.transferForm.getValues('toAccountId')).toBe('acc-1')
  })

  it('deve preparar edição de transferência quando encontrar contraparte local', async () => {
    const onTransferModalOpen = vi.fn()
    const onTransactionDetailsClose = vi.fn()

    const hook = renderHook(() =>
      useTransferForm({
        isTransferOpen: false,
        primaryAccountId: 'acc-1',
        defaultTransferToAccountId: 'acc-2',
        transactions: [transferExpense, transferIncome],
        createTransfer: vi.fn(),
        updateTransaction: vi.fn(),
        onTransferModalOpen,
        onTransferModalClose: vi.fn(),
        onTransactionDetailsClose,
      }),
    )

    await act(async () => {
      await hook.result.current.handleOpenEditTransfer(transferExpense)
    })

    expect(hook.result.current.transferEditContext).toEqual({
      expenseId: 'tx-exp',
      incomeId: 'tx-inc',
    })
    expect(onTransactionDetailsClose).toHaveBeenCalledTimes(1)
    expect(onTransferModalOpen).toHaveBeenCalledTimes(1)
  })
})
