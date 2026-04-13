import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useTransactionForm } from '@/features/transactions'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

const baseFormData: TransactionCreateFormData = {
  accountId: 'acc-1',
  categoryId: 'cat-1',
  subcategoryId: '',
  type: 'expense',
  amount: '$ 100,00',
  date: '2026-04-13',
  description: 'Teste',
  notes: '',
}

function makeHook() {
  const createTransaction = vi.fn().mockResolvedValue({ id: 'tx-1' })
  const createRecurrence = vi.fn().mockResolvedValue({})
  const deleteTransaction = vi.fn().mockResolvedValue({})
  const updateTransaction = vi.fn().mockResolvedValue({})
  const onCreateSuccess = vi.fn()
  const onEditSuccess = vi.fn()
  const setCreateRootError = vi.fn()
  const setEditRootError = vi.fn()
  const setCreateAmountError = vi.fn()
  const clearCreateAmountError = vi.fn()

  const hook = renderHook(() =>
    useTransactionForm({
      isCreateRecurrenceEnabled: false,
      recurrenceDraft: {
        startDate: '2026-04-13',
        frequency: 'monthly',
        endType: 'never',
        endOccurrences: '12',
        endDate: '',
        dayOfWeek: '1',
        dayOfMonth: '13',
        monthOfYear: '4',
      },
      selectedTransactionId: 'tx-1',
      createTransaction,
      createRecurrence,
      deleteTransaction,
      updateTransaction,
      onCreateSuccess,
      onEditSuccess,
      setCreateRootError,
      setEditRootError,
      setCreateAmountError,
      clearCreateAmountError,
    }),
  )

  return {
    hook,
    createTransaction,
    createRecurrence,
    deleteTransaction,
    updateTransaction,
    onCreateSuccess,
    onEditSuccess,
    setCreateRootError,
    setEditRootError,
    setCreateAmountError,
    clearCreateAmountError,
  }
}

describe('useTransactionForm', () => {
  it('deve validar expressão inválida no blur do valor', () => {
    const { hook, setCreateAmountError } = makeHook()
    const onChange = vi.fn()

    act(() => {
      hook.result.current.handleCreateAmountBlur('=2+(', onChange)
    })

    expect(setCreateAmountError).toHaveBeenCalled()
  })

  it('deve executar create e chamar onCreateSuccess', async () => {
    const { hook, createTransaction, onCreateSuccess } = makeHook()

    await act(async () => {
      await hook.result.current.onCreateSubmit(baseFormData)
    })

    expect(createTransaction).toHaveBeenCalledTimes(1)
    expect(onCreateSuccess).toHaveBeenCalledTimes(1)
  })

  it('deve executar update no edit e chamar onEditSuccess', async () => {
    const { hook, updateTransaction, onEditSuccess } = makeHook()

    await act(async () => {
      await hook.result.current.onEditSubmit({
        ...baseFormData,
        description: 'Editado',
      })
    })

    expect(updateTransaction).toHaveBeenCalledTimes(1)
    expect(onEditSuccess).toHaveBeenCalledTimes(1)
  })
})
