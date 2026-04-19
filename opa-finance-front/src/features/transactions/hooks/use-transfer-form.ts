import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

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
  updateTransaction: (input: {
    id: string
    payload: TransactionUpdatePayload
  }) => Promise<unknown>
  onTransferModalOpen: () => void
  onTransferModalClose: () => void
  onTransactionDetailsClose: () => void
}

export function useTransferForm({
  isTransferOpen,
  primaryAccountId,
  defaultTransferToAccountId,
  transactions,
  createTransfer,
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

  const clearTransferFeedback = useCallback(() => {
    setRepeatTransferError(null)
    setTransferEditError(null)
  }, [])

  const handleCloseTransferModal = useCallback(() => {
    onTransferModalClose()
    setTransferEditContext(null)
    setTransferEditError(null)
    transferForm.reset()
  }, [onTransferModalClose, transferForm])

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
    }
  }, [
    defaultTransferToAccountId,
    isTransferOpen,
    primaryAccountId,
    transferEditContext,
    transferForm,
    transferFromAccountId,
    transferToAccountId,
  ])

  const onTransferSubmit = useCallback(
    async (formData: TransferCreateFormData) => {
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
          await createTransfer(buildTransferCreatePayloadFromForm(formData))
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
    onTransferModalOpen()
  }, [onTransferModalOpen])

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
    clearTransferFeedback,
    openTransferCreate,
    handleCloseTransferModal,
    submitTransferForm,
    handleSwapTransferAccounts,
    handleOpenRepeatTransfer,
    handleOpenEditTransfer,
  }
}
