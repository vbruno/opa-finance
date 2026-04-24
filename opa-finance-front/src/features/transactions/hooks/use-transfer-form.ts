import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import type { RecurrenceCreatePayload } from '@/features/recurrences'
import type { TransferCreatePayload } from '@/features/transfers'
import { api } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/apiError'
import { setFormApiRootError } from '@/lib/form-api-error'
import { formatCurrencyValue } from '@/lib/utils'
import {
  transferCreateSchema,
  type TransferCreateFormData,
} from '@/schemas/transfer.schema'

import {
  buildTransferCreatePayloadFromForm,
  buildTransferRecurrencePayloadFromDraft,
  buildTransferUpdatePayloadsFromForm,
} from '../mappers/transfer-payload.mapper'
import { formatDateInput } from '../model/transactions.helpers'
import type { TransferEditContext } from '../model/transactions.types'
import type {
  Transaction,
  TransactionsListResponse,
  TransactionUpdatePayload,
} from '../transactions.api'

type UseTransferFormInput = {
  isTransferOpen: boolean
  primaryAccountId: string
  defaultTransferToAccountId: string
  transactions: Transaction[]
  createTransfer: (payload: TransferCreatePayload) => Promise<unknown>
  createRecurrence: (payload: RecurrenceCreatePayload) => Promise<unknown>
  deleteTransaction: (id: string) => Promise<unknown>
  updateTransaction: (input: {
    id: string
    payload: TransactionUpdatePayload
  }) => Promise<unknown>
  onTransferModalOpen: () => void
  onTransferModalClose: () => void
  onTransactionDetailsClose: () => void
}

function getCreatedTransferTransactionIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') {
    return []
  }

  const maybeResult = result as {
    fromAccount?: { id?: unknown }
    toAccount?: { id?: unknown }
  }

  const fromId =
    maybeResult.fromAccount && typeof maybeResult.fromAccount.id === 'string'
      ? maybeResult.fromAccount.id
      : null
  const toId =
    maybeResult.toAccount && typeof maybeResult.toAccount.id === 'string'
      ? maybeResult.toAccount.id
      : null

  return [fromId, toId].filter((value): value is string => Boolean(value))
}

export function useTransferForm({
  isTransferOpen,
  primaryAccountId,
  defaultTransferToAccountId,
  transactions,
  createTransfer,
  createRecurrence,
  deleteTransaction,
  updateTransaction,
  onTransferModalOpen,
  onTransferModalClose,
  onTransactionDetailsClose,
}: UseTransferFormInput) {
  const [transferEditContext, setTransferEditContext] =
    useState<TransferEditContext | null>(null)
  const [repeatTransferError, setRepeatTransferError] = useState<string | null>(
    null,
  )
  const [transferEditError, setTransferEditError] = useState<string | null>(
    null,
  )
  const [isRepeatTransferLoading, setIsRepeatTransferLoading] = useState(false)
  const [isEditTransferLoading, setIsEditTransferLoading] = useState(false)

  const transferForm = useForm<TransferCreateFormData>({
    resolver: zodResolver(transferCreateSchema),
    defaultValues: {
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      date: '',
      description: '',
    },
  })

  const transferFromAccountId = transferForm.watch('fromAccountId')
  const transferToAccountId = transferForm.watch('toAccountId')
  const transferDate = transferForm.watch('date')

  const [isTransferRecurrenceEnabled, setIsTransferRecurrenceEnabled] =
    useState(false)
  const [transferRecurrenceStartDate, setTransferRecurrenceStartDate] =
    useState('')
  const [isTransferRecurrenceStartDateTouched, setIsTransferRecurrenceStartDateTouched] =
    useState(false)
  const [transferRecurrenceFrequency, setTransferRecurrenceFrequency] = useState<
    'weekly' | 'biweekly' | 'monthly' | 'yearly'
  >('monthly')
  const [transferRecurrenceEndType, setTransferRecurrenceEndType] = useState<
    'never' | 'by_occurrences' | 'until_date'
  >('never')
  const [transferRecurrenceEndOccurrences, setTransferRecurrenceEndOccurrences] =
    useState('12')
  const [transferRecurrenceEndDate, setTransferRecurrenceEndDate] = useState('')
  const [transferRecurrenceDayOfWeek, setTransferRecurrenceDayOfWeek] =
    useState('1')
  const [transferRecurrenceDayOfMonth, setTransferRecurrenceDayOfMonth] =
    useState('1')
  const [transferRecurrenceMonthOfYear, setTransferRecurrenceMonthOfYear] =
    useState('1')

  const resetTransferRecurrenceDraft = useCallback((baseDate?: string) => {
    const safeDate =
      baseDate && /^\d{4}-\d{2}-\d{2}$/.test(baseDate)
        ? new Date(`${baseDate}T12:00:00`)
        : new Date()

    setTransferRecurrenceStartDate(formatDateInput(safeDate))
    setIsTransferRecurrenceStartDateTouched(false)
    setTransferRecurrenceFrequency('monthly')
    setTransferRecurrenceEndType('never')
    setTransferRecurrenceEndOccurrences('12')
    setTransferRecurrenceEndDate('')
    setTransferRecurrenceDayOfWeek(String(safeDate.getDay()))
    setTransferRecurrenceDayOfMonth(String(safeDate.getDate()))
    setTransferRecurrenceMonthOfYear(String(safeDate.getMonth() + 1))
  }, [])

  useEffect(() => {
    if (!isTransferRecurrenceEnabled || isTransferRecurrenceStartDateTouched) {
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transferDate || '')) {
      return
    }
    setTransferRecurrenceStartDate(transferDate)
  }, [
    isTransferRecurrenceEnabled,
    isTransferRecurrenceStartDateTouched,
    transferDate,
  ])

  const clearTransferFeedback = useCallback(() => {
    setRepeatTransferError(null)
    setTransferEditError(null)
  }, [])

  const handleCloseTransferModal = useCallback(() => {
    onTransferModalClose()
    setTransferEditContext(null)
    setTransferEditError(null)
    setIsTransferRecurrenceEnabled(false)
    resetTransferRecurrenceDraft()
    transferForm.reset()
  }, [onTransferModalClose, resetTransferRecurrenceDraft, transferForm])

  useEffect(() => {
    if (!isTransferOpen) {
      return
    }

    if (!transferEditContext) {
      transferForm.setValue('date', formatDateInput(new Date()))
      if (!transferFromAccountId && primaryAccountId) {
        transferForm.setValue('fromAccountId', primaryAccountId)
      }
      if (
        !transferToAccountId &&
        defaultTransferToAccountId &&
        defaultTransferToAccountId !== transferFromAccountId
      ) {
        transferForm.setValue('toAccountId', defaultTransferToAccountId)
      }

      if (!isTransferRecurrenceEnabled) {
        resetTransferRecurrenceDraft(transferForm.getValues('date'))
      }
    }
  }, [
    defaultTransferToAccountId,
    isTransferOpen,
    primaryAccountId,
    transferEditContext,
    transferForm,
    transferFromAccountId,
    transferToAccountId,
    isTransferRecurrenceEnabled,
    resetTransferRecurrenceDraft,
  ])

  const onTransferSubmit = useCallback(
    async (formData: TransferCreateFormData) => {
      const transferPayload = buildTransferCreatePayloadFromForm(formData)
      const transferRecurrencePayloadResult =
        isTransferRecurrenceEnabled && !transferEditContext
          ? buildTransferRecurrencePayloadFromDraft({
              fromAccountId: formData.fromAccountId,
              toAccountId: formData.toAccountId,
              amount: transferPayload.amount,
              description: formData.description ?? undefined,
              startDate: transferRecurrenceStartDate,
              frequency: transferRecurrenceFrequency,
              endType: transferRecurrenceEndType,
              endOccurrences: transferRecurrenceEndOccurrences,
              endDate: transferRecurrenceEndDate,
              dayOfWeek: transferRecurrenceDayOfWeek,
              dayOfMonth: transferRecurrenceDayOfMonth,
              monthOfYear: transferRecurrenceMonthOfYear,
            })
          : { payload: null, error: null }

      if (transferRecurrencePayloadResult.error) {
        transferForm.setError('root', {
          message: transferRecurrencePayloadResult.error,
        })
        return
      }

      try {
        if (transferEditContext) {
          const payloads = buildTransferUpdatePayloadsFromForm(
            formData,
            transferEditContext,
          )
          await Promise.all([
            updateTransaction(payloads.expense),
            updateTransaction(payloads.income),
          ])
        } else {
          const createdTransfer = await createTransfer(transferPayload)

          if (transferRecurrencePayloadResult.payload) {
            try {
              await createRecurrence(transferRecurrencePayloadResult.payload)
            } catch (recurrenceError) {
              const rollbackIds = getCreatedTransferTransactionIds(createdTransfer)
              let rollbackSucceeded = false

              if (rollbackIds.length > 0) {
                const rollbackResults = await Promise.allSettled(
                  rollbackIds.map((id) => deleteTransaction(id)),
                )
                rollbackSucceeded = rollbackResults.every(
                  (result) => result.status === 'fulfilled',
                )
              }

              const rollbackMessage = rollbackSucceeded
                ? 'A transferência foi revertida.'
                : 'Não foi possível reverter a transferência automaticamente. Verifique a lista de transações.'

              transferForm.setError('root', {
                message: `Falha ao criar recorrência da transferência. ${rollbackMessage} ${getApiErrorMessage(
                  recurrenceError,
                  { defaultMessage: '' },
                )}`.trim(),
              })
              return
            }
          }
        }

        handleCloseTransferModal()
      } catch (error: unknown) {
        setFormApiRootError({
          error,
          setError: transferForm.setError,
          options: {
            defaultMessage: transferEditContext
              ? 'Erro ao atualizar transferência. Tente novamente.'
              : 'Erro ao criar transferência. Tente novamente.',
          },
        })
      }
    },
    [
      createTransfer,
      handleCloseTransferModal,
      transferEditContext,
      transferForm,
      updateTransaction,
      createRecurrence,
      deleteTransaction,
      isTransferRecurrenceEnabled,
      transferRecurrenceDayOfMonth,
      transferRecurrenceDayOfWeek,
      transferRecurrenceEndDate,
      transferRecurrenceEndOccurrences,
      transferRecurrenceEndType,
      transferRecurrenceFrequency,
      transferRecurrenceMonthOfYear,
      transferRecurrenceStartDate,
    ],
  )

  const submitTransferForm = transferForm.handleSubmit(onTransferSubmit)

  useEffect(() => {
    if (!isTransferOpen) {
      return
    }

    const handleTransferShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void submitTransferForm()
      }
    }

    window.addEventListener('keydown', handleTransferShortcut, true)
    return () => {
      window.removeEventListener('keydown', handleTransferShortcut, true)
    }
  }, [isTransferOpen, submitTransferForm])

  const handleSwapTransferAccounts = useCallback(() => {
    const fromAccountId = transferForm.getValues('fromAccountId')
    const toAccountId = transferForm.getValues('toAccountId')
    transferForm.setValue('fromAccountId', toAccountId)
    transferForm.setValue('toAccountId', fromAccountId)
  }, [transferForm])

  const findTransferCounterpart = useCallback(
    async (transaction: Transaction) => {
      if (!transaction.transferId) {
        return null
      }
      const localMatch = transactions.find(
        (item) =>
          item.transferId === transaction.transferId &&
          item.id !== transaction.id,
      )
      if (localMatch) {
        return localMatch
      }
      const limit = 100
      let page = 1
      let totalPages = 1

      while (page <= totalPages) {
        const response = await api.get<TransactionsListResponse>(
          '/transactions',
          {
            params: {
              page,
              limit,
              startDate: transaction.date,
              endDate: transaction.date,
            },
          },
        )
        const result = response.data
        totalPages = Math.max(1, Math.ceil(result.total / result.limit))
        const match = result.data.find(
          (item) =>
            item.transferId === transaction.transferId &&
            item.id !== transaction.id,
        )
        if (match) {
          return match
        }
        page += 1
      }

      return null
    },
    [transactions],
  )

  const openTransferCreate = useCallback(() => {
    setTransferEditContext(null)
    setTransferEditError(null)
    setIsTransferRecurrenceEnabled(false)
    resetTransferRecurrenceDraft(formatDateInput(new Date()))
    onTransferModalOpen()
  }, [onTransferModalOpen, resetTransferRecurrenceDraft])

  const handleOpenRepeatTransfer = useCallback(
    async (transaction: Transaction) => {
      if (!transaction.transferId || isRepeatTransferLoading) {
        return
      }

      setTransferEditContext(null)
      setRepeatTransferError(null)
      setIsRepeatTransferLoading(true)
      try {
        const relatedTransfer = await findTransferCounterpart(transaction)
        if (!relatedTransfer) {
          setRepeatTransferError(
            'Não foi possível localizar a outra conta da transferência.',
          )
          return
        }
        const isExpense = transaction.type === 'expense'
        const fromAccountId = isExpense
          ? transaction.accountId
          : relatedTransfer.accountId
        const toAccountId = isExpense
          ? relatedTransfer.accountId
          : transaction.accountId

        if (!fromAccountId || !toAccountId) {
          setRepeatTransferError(
            'Não foi possível definir as contas da transferência.',
          )
          return
        }

        transferForm.reset({
          fromAccountId,
          toAccountId,
          amount: `$ ${formatCurrencyValue(transaction.amount)}`,
          date: formatDateInput(new Date()),
          description: transaction.description ?? '',
        })
        onTransactionDetailsClose()
        onTransferModalOpen()
      } catch (error: unknown) {
        setRepeatTransferError(
          getApiErrorMessage(error, {
            defaultMessage:
              'Erro ao carregar os dados da transferência. Tente novamente.',
          }),
        )
      } finally {
        setIsRepeatTransferLoading(false)
      }
    },
    [
      findTransferCounterpart,
      isRepeatTransferLoading,
      onTransactionDetailsClose,
      onTransferModalOpen,
      transferForm,
    ],
  )

  const handleOpenEditTransfer = useCallback(
    async (transaction: Transaction) => {
      if (!transaction.transferId || isEditTransferLoading) {
        return
      }

      setTransferEditError(null)
      setIsEditTransferLoading(true)
      try {
        const relatedTransfer = await findTransferCounterpart(transaction)
        if (!relatedTransfer) {
          setTransferEditError(
            'Não foi possível localizar a outra conta da transferência.',
          )
          return
        }
        const isExpense = transaction.type === 'expense'
        const expenseTransaction = isExpense ? transaction : relatedTransfer
        const incomeTransaction = isExpense ? relatedTransfer : transaction

        setTransferEditContext({
          expenseId: expenseTransaction.id,
          incomeId: incomeTransaction.id,
        })

        transferForm.reset({
          fromAccountId: expenseTransaction.accountId,
          toAccountId: incomeTransaction.accountId,
          amount: `$ ${formatCurrencyValue(transaction.amount)}`,
          date: transaction.date,
          description: transaction.description ?? '',
        })
        onTransactionDetailsClose()
        onTransferModalOpen()
      } catch (error: unknown) {
        setTransferEditError(
          getApiErrorMessage(error, {
            defaultMessage:
              'Erro ao carregar os dados da transferência. Tente novamente.',
          }),
        )
      } finally {
        setIsEditTransferLoading(false)
      }
    },
    [
      findTransferCounterpart,
      isEditTransferLoading,
      onTransactionDetailsClose,
      onTransferModalOpen,
      transferForm,
    ],
  )

  return {
    transferForm,
    transferEditContext,
    transferEditError,
    repeatTransferError,
    isRepeatTransferLoading,
    isEditTransferLoading,
    transferFromAccountId,
    transferToAccountId,
    isTransferRecurrenceEnabled,
    setIsTransferRecurrenceEnabled,
    transferRecurrenceStartDate,
    setTransferRecurrenceStartDate,
    setIsTransferRecurrenceStartDateTouched,
    transferRecurrenceFrequency,
    setTransferRecurrenceFrequency,
    transferRecurrenceEndType,
    setTransferRecurrenceEndType,
    transferRecurrenceEndOccurrences,
    setTransferRecurrenceEndOccurrences,
    transferRecurrenceEndDate,
    setTransferRecurrenceEndDate,
    transferRecurrenceDayOfWeek,
    setTransferRecurrenceDayOfWeek,
    transferRecurrenceDayOfMonth,
    setTransferRecurrenceDayOfMonth,
    transferRecurrenceMonthOfYear,
    setTransferRecurrenceMonthOfYear,
    resetTransferRecurrenceDraft,
    clearTransferFeedback,
    openTransferCreate,
    handleCloseTransferModal,
    submitTransferForm,
    handleSwapTransferAccounts,
    handleOpenRepeatTransfer,
    handleOpenEditTransfer,
  }
}
