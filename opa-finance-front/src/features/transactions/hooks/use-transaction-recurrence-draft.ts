import { useCallback, useEffect, useState } from 'react'

import { formatDateInput } from '../model/transactions.helpers'
import { isIsoDate } from '../model/transactions.helpers'
import type {
  TransactionRecurrenceDraft,
  TransactionRecurrenceEndType,
  TransactionRecurrenceFrequency,
} from '../model/transactions.types'

type UseTransactionRecurrenceDraftInput = {
  createDate: string
}

export function useTransactionRecurrenceDraft({
  createDate,
}: UseTransactionRecurrenceDraftInput) {
  const [isCreateRecurrenceEnabled, setIsCreateRecurrenceEnabled] =
    useState(false)
  const [createRecurrenceStartDate, setCreateRecurrenceStartDate] = useState('')
  const [isCreateRecurrenceStartDateTouched, setIsCreateRecurrenceStartDateTouched] =
    useState(false)
  const [createRecurrenceFrequency, setCreateRecurrenceFrequency] =
    useState<TransactionRecurrenceFrequency>('monthly')
  const [createRecurrenceEndType, setCreateRecurrenceEndType] =
    useState<TransactionRecurrenceEndType>('never')
  const [createRecurrenceEndOccurrences, setCreateRecurrenceEndOccurrences] =
    useState('12')
  const [createRecurrenceEndDate, setCreateRecurrenceEndDate] = useState('')
  const [createRecurrenceDayOfWeek, setCreateRecurrenceDayOfWeek] = useState('1')
  const [createRecurrenceDayOfMonth, setCreateRecurrenceDayOfMonth] =
    useState('1')
  const [createRecurrenceMonthOfYear, setCreateRecurrenceMonthOfYear] =
    useState('1')

  const resetCreateRecurrenceDraft = useCallback((baseDate?: string) => {
    const safeDate = baseDate && isIsoDate(baseDate)
      ? new Date(`${baseDate}T12:00:00`)
      : new Date()
    setCreateRecurrenceStartDate(formatDateInput(safeDate))
    setIsCreateRecurrenceStartDateTouched(false)
    setCreateRecurrenceFrequency('monthly')
    setCreateRecurrenceEndType('never')
    setCreateRecurrenceEndOccurrences('12')
    setCreateRecurrenceEndDate('')
    setCreateRecurrenceDayOfWeek(String(safeDate.getDay()))
    setCreateRecurrenceDayOfMonth(String(safeDate.getDate()))
    setCreateRecurrenceMonthOfYear(String(safeDate.getMonth() + 1))
  }, [])

  useEffect(() => {
    if (!isCreateRecurrenceEnabled || isCreateRecurrenceStartDateTouched) {
      return
    }
    if (!isIsoDate(createDate)) {
      return
    }
    setCreateRecurrenceStartDate(createDate)
  }, [createDate, isCreateRecurrenceEnabled, isCreateRecurrenceStartDateTouched])

  const recurrenceDraft: TransactionRecurrenceDraft = {
    startDate: createRecurrenceStartDate,
    frequency: createRecurrenceFrequency,
    endType: createRecurrenceEndType,
    endOccurrences: createRecurrenceEndOccurrences,
    endDate: createRecurrenceEndDate,
    dayOfWeek: createRecurrenceDayOfWeek,
    dayOfMonth: createRecurrenceDayOfMonth,
    monthOfYear: createRecurrenceMonthOfYear,
  }

  return {
    isCreateRecurrenceEnabled,
    setIsCreateRecurrenceEnabled,
    createRecurrenceStartDate,
    setCreateRecurrenceStartDate,
    setIsCreateRecurrenceStartDateTouched,
    createRecurrenceFrequency,
    setCreateRecurrenceFrequency,
    createRecurrenceEndType,
    setCreateRecurrenceEndType,
    createRecurrenceEndOccurrences,
    setCreateRecurrenceEndOccurrences,
    createRecurrenceEndDate,
    setCreateRecurrenceEndDate,
    createRecurrenceDayOfWeek,
    setCreateRecurrenceDayOfWeek,
    createRecurrenceDayOfMonth,
    setCreateRecurrenceDayOfMonth,
    createRecurrenceMonthOfYear,
    setCreateRecurrenceMonthOfYear,
    resetCreateRecurrenceDraft,
    recurrenceDraft,
  }
}
