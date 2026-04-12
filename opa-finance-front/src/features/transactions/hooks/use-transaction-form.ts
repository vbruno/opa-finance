import { useCallback } from 'react'

import type { RecurrenceCreatePayload } from '@/features/recurrences'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  formatCurrencyInput,
  formatCurrencyValue,
  parseCurrencyInput,
  sanitizeExpressionInput,
} from '@/lib/utils'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

import {
  buildRecurrencePayloadFromDraft,
  buildTransactionCreatePayloadFromForm,
  buildTransactionUpdatePayloadFromForm,
} from '../mappers/transaction-payload.mapper'
import type { SetTransactionAmountValue } from '../model/transactions.types'
import type {
  Transaction,
  TransactionCreatePayload,
  TransactionUpdatePayload,
} from '../transactions.api'

type UseTransactionFormInput = {
  isCreateRecurrenceEnabled: boolean
  recurrenceDraft: {
    startDate: string
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
    endType: 'never' | 'by_occurrences' | 'until_date'
    endOccurrences: string
    endDate: string
    dayOfWeek: string
    dayOfMonth: string
    monthOfYear: string
  }
  selectedTransactionId: string | null
  createTransaction: (payload: TransactionCreatePayload) => Promise<Transaction>
  createRecurrence: (payload: RecurrenceCreatePayload) => Promise<unknown>
  deleteTransaction: (id: string) => Promise<unknown>
  updateTransaction: (input: {
    id: string
    payload: TransactionUpdatePayload
  }) => Promise<unknown>
  onCreateSuccess: () => void
  onEditSuccess: () => void
  setCreateRootError: (message: string) => void
  setEditRootError: (message: string) => void
  setCreateAmountError: (message: string) => void
  clearCreateAmountError: () => void
}

export function useTransactionForm({
  isCreateRecurrenceEnabled,
  recurrenceDraft,
  selectedTransactionId,
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
}: UseTransactionFormInput) {
  const handleTransactionAmountChange = useCallback(
    (rawValue: string, onChange: SetTransactionAmountValue) => {
      if (rawValue.trimStart().startsWith('=')) {
        onChange(sanitizeExpressionInput(rawValue))
        return
      }
      onChange(formatCurrencyInput(rawValue))
    },
    [],
  )

  const handleCreateAmountBlur = useCallback(
    (value: string, onChange: SetTransactionAmountValue) => {
      const trimmed = value.trim()
      if (!trimmed.startsWith('=')) {
        return
      }

      const parsed = parseCurrencyInput(trimmed)
      if (parsed === null || Number.isNaN(parsed) || parsed <= 0) {
        setCreateAmountError('Informe uma expressão válida.')
        return
      }

      onChange(`$ ${formatCurrencyValue(parsed)}`)
      clearCreateAmountError()
    },
    [clearCreateAmountError, setCreateAmountError],
  )

  const onCreateSubmit = useCallback(
    async (formData: TransactionCreateFormData) => {
      const transactionPayload = buildTransactionCreatePayloadFromForm(formData)

      const recurrencePayloadResult = isCreateRecurrenceEnabled
        ? buildRecurrencePayloadFromDraft({
            accountId: formData.accountId,
            categoryId: formData.categoryId,
            subcategoryId: formData.subcategoryId || undefined,
            amount: transactionPayload.amount,
            description: formData.description ?? undefined,
            notes: formData.notes ?? undefined,
            startDate: recurrenceDraft.startDate,
            frequency: recurrenceDraft.frequency,
            endType: recurrenceDraft.endType,
            endOccurrences: recurrenceDraft.endOccurrences,
            endDate: recurrenceDraft.endDate,
            dayOfWeek: recurrenceDraft.dayOfWeek,
            dayOfMonth: recurrenceDraft.dayOfMonth,
            monthOfYear: recurrenceDraft.monthOfYear,
          })
        : { payload: null, error: null }

      if (recurrencePayloadResult.error) {
        setCreateRootError(recurrencePayloadResult.error)
        return
      }

      try {
        const createdTransaction = await createTransaction(transactionPayload)

        if (recurrencePayloadResult.payload) {
          try {
            await createRecurrence(recurrencePayloadResult.payload)
          } catch (recurrenceError) {
            let rollbackSucceeded = false
            try {
              await deleteTransaction(createdTransaction.id)
              rollbackSucceeded = true
            } catch {
              // best-effort rollback
            }

            const rollbackMessage = rollbackSucceeded
              ? 'A transação foi revertida.'
              : 'Não foi possível reverter a transação automaticamente. Verifique a lista de transações.'

            setCreateRootError(
              `Falha ao criar recorrência. ${rollbackMessage} ${getApiErrorMessage(
                recurrenceError,
                { defaultMessage: '' },
              )}`.trim(),
            )
            return
          }
        }

        onCreateSuccess()
      } catch (error: unknown) {
        setCreateRootError(
          getApiErrorMessage(error, {
            defaultMessage: 'Erro ao criar transação. Tente novamente.',
          }),
        )
      }
    },
    [
      createRecurrence,
      createTransaction,
      deleteTransaction,
      isCreateRecurrenceEnabled,
      onCreateSuccess,
      recurrenceDraft.dayOfMonth,
      recurrenceDraft.dayOfWeek,
      recurrenceDraft.endDate,
      recurrenceDraft.endOccurrences,
      recurrenceDraft.endType,
      recurrenceDraft.frequency,
      recurrenceDraft.monthOfYear,
      recurrenceDraft.startDate,
      setCreateRootError,
    ],
  )

  const onEditSubmit = useCallback(
    async (formData: TransactionCreateFormData) => {
      if (!selectedTransactionId) {
        return
      }

      try {
        await updateTransaction({
          id: selectedTransactionId,
          payload: buildTransactionUpdatePayloadFromForm(formData),
        })
        onEditSuccess()
      } catch (error: unknown) {
        setEditRootError(
          getApiErrorMessage(error, {
            defaultMessage: 'Erro ao atualizar transação. Tente novamente.',
          }),
        )
      }
    },
    [onEditSuccess, selectedTransactionId, setEditRootError, updateTransaction],
  )

  return {
    handleTransactionAmountChange,
    handleCreateAmountBlur,
    onCreateSubmit,
    onEditSubmit,
  }
}
