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
  const updateTransaction = vi.fn().mockResolvedValue({})
  const onCreateSuccess = vi.fn()
  const onEditSuccess = vi.fn()
  const setCreateRootError = vi.fn()
  const setEditRootError = vi.fn()

  const hook = renderHook(() =>
    useTransactionForm({
      mode: 'create',
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
      updateTransaction,
      onCreateSuccess,
      onEditSuccess,
      setCreateRootError,
      setEditRootError,
    }),
  )

  return {
    hook,
    createTransaction,
    updateTransaction,
    onCreateSuccess,
    onEditSuccess,
    setCreateRootError,
    setEditRootError,
  }
}

describe('useTransactionForm', () => {
  it('deve executar create e chamar onCreateSuccess', async () => {
    const { hook, createTransaction, onCreateSuccess } = makeHook()

    await act(async () => {
      await hook.result.current.onSubmit(baseFormData)
    })

    expect(createTransaction).toHaveBeenCalledTimes(1)
    expect(onCreateSuccess).toHaveBeenCalledTimes(1)
  })

  it('deve criar transação de receita corretamente', async () => {
    const { hook, createTransaction } = makeHook()

    await act(async () => {
      await hook.result.current.onSubmit({
        ...baseFormData,
        categoryId: 'cat-income',
        type: 'income',
        description: 'Salário',
      })
    })

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cat-income',
        type: 'income',
        description: 'Salário',
      }),
    )
  })

  it('deve montar payload de recorrência para weekly, monthly e yearly', async () => {
    const createTransaction = vi.fn().mockResolvedValue({ id: 'tx-1' })

    const buildHook = (frequency: 'weekly' | 'monthly' | 'yearly') =>
      renderHook(() =>
        useTransactionForm({
          mode: 'create',
          isCreateRecurrenceEnabled: true,
          recurrenceDraft: {
            startDate: '2026-04-13',
            frequency,
            endType: 'never',
            endOccurrences: '',
            endDate: '',
            dayOfWeek: '1',
            dayOfMonth: '13',
            monthOfYear: '4',
          },
          selectedTransactionId: null,
          createTransaction,
          updateTransaction: vi.fn(),
          onCreateSuccess: vi.fn(),
          onEditSuccess: vi.fn(),
          setCreateRootError: vi.fn(),
          setEditRootError: vi.fn(),
        }),
      )

    const weeklyHook = buildHook('weekly')
    await act(async () => {
      await weeklyHook.result.current.onSubmit(baseFormData)
    })

    const monthlyHook = buildHook('monthly')
    await act(async () => {
      await monthlyHook.result.current.onSubmit(baseFormData)
    })

    const yearlyHook = buildHook('yearly')
    await act(async () => {
      await yearlyHook.result.current.onSubmit(baseFormData)
    })

    const payloads = createTransaction.mock.calls.map(([payload]) => payload)
    expect(payloads).toHaveLength(3)
    expect(payloads.map((payload) => payload.recurrence?.frequency)).toEqual([
      'weekly',
      'monthly',
      'yearly',
    ])
  })

  it('deve executar update no edit e chamar onEditSuccess', async () => {
    const updateTransaction = vi.fn().mockResolvedValue({})
    const onEditSuccess = vi.fn()
    const setEditRootError = vi.fn()

    const hook = renderHook(() =>
      useTransactionForm({
        mode: 'edit',
        selectedTransactionId: 'tx-1',
        updateTransaction,
        onEditSuccess,
        setEditRootError,
      }),
    )

    await act(async () => {
      await hook.result.current.onSubmit({
        ...baseFormData,
        description: 'Editado',
      })
    })

    expect(updateTransaction).toHaveBeenCalledTimes(1)
    expect(onEditSuccess).toHaveBeenCalledTimes(1)
  })
})
