import type { TransferCreatePayload } from '@/features/transfers'
import { parseCurrencyInput } from '@/lib/utils'
import type { TransferCreateFormData } from '@/schemas/transfer.schema'

import type { TransferEditContext } from '../model/transactions.types'
import type { TransactionUpdatePayload } from '../transactions.api'

export function buildTransferCreatePayloadFromForm(
  formData: TransferCreateFormData,
): TransferCreatePayload {
  return {
    fromAccountId: formData.fromAccountId,
    toAccountId: formData.toAccountId,
    amount: parseCurrencyInput(formData.amount) ?? 0,
    date: formData.date,
    description: formData.description?.trim() || null,
  }
}

export function buildTransferUpdatePayloadsFromForm(
  formData: TransferCreateFormData,
  context: TransferEditContext,
): {
  expense: { id: string; payload: TransactionUpdatePayload }
  income: { id: string; payload: TransactionUpdatePayload }
} {
  const parsedAmount = parseCurrencyInput(formData.amount) ?? 0
  const payload: TransactionUpdatePayload = {
    amount: parsedAmount,
    date: formData.date,
    description: formData.description?.trim() || null,
  }

  return {
    expense: {
      id: context.expenseId,
      payload: {
        ...payload,
        accountId: formData.fromAccountId,
      },
    },
    income: {
      id: context.incomeId,
      payload: {
        ...payload,
        accountId: formData.toAccountId,
      },
    },
  }
}
