import type { RecurrenceCreatePayload } from '@/features/recurrences'

import { isIsoDate } from '../model/transactions.helpers'

export type RecurrenceDraftInput = {
  accountId: string
  categoryId: string
  subcategoryId?: string
  amount: number
  description?: string
  notes?: string
  startDate: string
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  endType: 'never' | 'by_occurrences' | 'until_date'
  endOccurrences: string
  endDate: string
  dayOfWeek: string
  dayOfMonth: string
  monthOfYear: string
}

export type BuildRecurrencePayloadResult = {
  payload: RecurrenceCreatePayload | null
  error: string | null
}

export function buildRecurrencePayloadFromDraft(
  input: RecurrenceDraftInput,
): BuildRecurrencePayloadResult {
  if (!isIsoDate(input.startDate)) {
    return {
      payload: null,
      error: 'Informe uma data inicial válida para a recorrência.',
    }
  }

  const payload: RecurrenceCreatePayload = {
    originType: 'transaction',
    accountId: input.accountId,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    amount: input.amount,
    description: input.description?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
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
