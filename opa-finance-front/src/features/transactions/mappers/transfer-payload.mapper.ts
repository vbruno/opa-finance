import type { RecurrenceCreatePayload } from '@/features/recurrences'
import type { TransferCreatePayload } from '@/features/transfers'
import { parseCurrencyInput } from '@/lib/utils'
import type { TransferCreateFormData } from '@/schemas/transfer.schema'

import { isIsoDate } from '../model/transactions.helpers'
import type { TransferEditContext } from '../model/transactions.types'
import type { TransactionUpdatePayload } from '../transactions.api'

export type TransferRecurrenceDraftInput = {
  fromAccountId: string
  toAccountId: string
  amount: number
  description?: string
  startDate: string
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  endType: 'never' | 'by_occurrences' | 'until_date'
  endOccurrences: string
  endDate: string
  dayOfWeek: string
  dayOfMonth: string
  monthOfYear: string
}

export type BuildTransferRecurrencePayloadResult = {
  payload: RecurrenceCreatePayload | null
  error: string | null
}

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

export function buildTransferRecurrencePayloadFromDraft(
  input: TransferRecurrenceDraftInput,
): BuildTransferRecurrencePayloadResult {
  if (!isIsoDate(input.startDate)) {
    return {
      payload: null,
      error: 'Informe uma data inicial válida para a recorrência.',
    }
  }

  const payload: RecurrenceCreatePayload = {
    originType: 'transfer',
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    description: input.description?.trim() || undefined,
    frequency: input.frequency,
    startDate: input.startDate,
    endType: input.endType,
  }

  if (input.frequency === 'weekly' || input.frequency === 'biweekly') {
    const dayOfWeek = Number(input.dayOfWeek)
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return {
        payload: null,
        error: 'Informe o dia da semana (0 a 6) para a recorrência.',
      }
    }
    payload.dayOfWeek = dayOfWeek
  }

  if (input.frequency === 'monthly' || input.frequency === 'yearly') {
    const dayOfMonth = Number(input.dayOfMonth)
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      return {
        payload: null,
        error: 'Informe o dia do mês (1 a 31) para a recorrência.',
      }
    }
    payload.dayOfMonth = dayOfMonth
  }

  if (input.frequency === 'yearly') {
    const monthOfYear = Number(input.monthOfYear)
    if (!Number.isInteger(monthOfYear) || monthOfYear < 1 || monthOfYear > 12) {
      return {
        payload: null,
        error: 'Informe o mês (1 a 12) para a recorrência anual.',
      }
    }
    payload.monthOfYear = monthOfYear
  }

  if (input.endType === 'by_occurrences') {
    const endOccurrences = Number(input.endOccurrences)
    if (!Number.isInteger(endOccurrences) || endOccurrences < 1) {
      return {
        payload: null,
        error: 'Informe a quantidade de ocorrências da recorrência.',
      }
    }
    payload.endOccurrences = endOccurrences
  }

  if (input.endType === 'until_date') {
    if (!isIsoDate(input.endDate)) {
      return {
        payload: null,
        error: 'Informe a data final da recorrência.',
      }
    }
    if (input.endDate < input.startDate) {
      return {
        payload: null,
        error: 'A data final da recorrência não pode ser menor que a data inicial.',
      }
    }
    payload.endDate = input.endDate
  }

  return {
    payload,
    error: null,
  }
}
