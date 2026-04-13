import type { ControllerRenderProps } from 'react-hook-form'

import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

export type SetTransactionAmountValue = ControllerRenderProps<
  TransactionCreateFormData,
  'amount'
>['onChange']

export type TransactionRecurrenceFrequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly'

export type TransactionRecurrenceEndType =
  | 'never'
  | 'by_occurrences'
  | 'until_date'

export type TransactionRecurrenceDraft = {
  startDate: string
  frequency: TransactionRecurrenceFrequency
  endType: TransactionRecurrenceEndType
  endOccurrences: string
  endDate: string
  dayOfWeek: string
  dayOfMonth: string
  monthOfYear: string
}

export type TransferEditContext = {
  expenseId: string
  incomeId: string
}
