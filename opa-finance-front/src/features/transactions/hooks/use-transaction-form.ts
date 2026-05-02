import { useCallback } from 'react'

import { getApiErrorMessage } from '@/lib/apiError'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

import {
  buildRecurrencePayloadFromDraft,
  buildTransactionCreatePayloadFromForm,
  buildTransactionUpdatePayloadFromForm,
} from '../mappers/transaction-payload.mapper'
import type { TransactionRecurrenceDraft } from '../model/transactions.types'
import type {
  Transaction,
  TransactionCreatePayload,
  TransactionUpdatePayload,
} from '../transactions.api'

type UseTransactionFormInput = {
  mode: 'create' | 'edit'
  selectedTransactionId: string | null
  updateTransaction: (input: {
    id: string
    payload: TransactionUpdatePayload
  }) => Promise<unknown>
  onEditSuccess: () => void
  setEditRootError: (message: string) => void
}

type UseTransactionFormCreateInput = UseTransactionFormInput & {
  mode: 'create'
  isCreateRecurrenceEnabled: boolean
  recurrenceDraft: TransactionRecurrenceDraft
  createTransaction: (payload: TransactionCreatePayload) => Promise<Transaction>
  onCreateSuccess: () => void
  setCreateRootError: (message: string) => void
}

type UseTransactionFormEditInput = UseTransactionFormInput & {
  mode: 'edit'
}

type UseTransactionFormInputUnion =
  | UseTransactionFormCreateInput
  | UseTransactionFormEditInput

export function useTransactionForm(input: UseTransactionFormInputUnion) {
  const {
    selectedTransactionId,
    updateTransaction,
    onEditSuccess,
    setEditRootError,
  } = input

  const onSubmit = useCallback(
    async (formData: TransactionCreateFormData) => {
      if (input.mode === 'create') {
        const transactionPayload = buildTransactionCreatePayloadFromForm(formData)

        if (input.isCreateRecurrenceEnabled) {
          const recurrencePayloadResult = buildRecurrencePayloadFromDraft({
            accountId: formData.accountId,
            categoryId: formData.categoryId,
            subcategoryId: formData.subcategoryId || undefined,
            amount: transactionPayload.amount,
            description: formData.description ?? undefined,
            notes: formData.notes ?? undefined,
            startDate: input.recurrenceDraft.startDate,
            frequency: input.recurrenceDraft.frequency,
            endType: input.recurrenceDraft.endType,
            endOccurrences: input.recurrenceDraft.endOccurrences,
            endDate: input.recurrenceDraft.endDate,
            dayOfWeek: input.recurrenceDraft.dayOfWeek,
            dayOfMonth: input.recurrenceDraft.dayOfMonth,
            monthOfYear: input.recurrenceDraft.monthOfYear,
          })

          if (recurrencePayloadResult.error) {
            input.setCreateRootError(recurrencePayloadResult.error)
            return
          }

          transactionPayload.recurrence = recurrencePayloadResult.payload ?? undefined
        }

        try {
          await input.createTransaction(transactionPayload)
          input.onCreateSuccess()
          return
        } catch (error: unknown) {
          input.setCreateRootError(
            getApiErrorMessage(error, {
              defaultMessage: 'Erro ao criar transação. Tente novamente.',
            }),
          )
          return
        }
      }

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
    [input, onEditSuccess, selectedTransactionId, setEditRootError, updateTransaction],
  )

  return {
    onSubmit,
  }
}
