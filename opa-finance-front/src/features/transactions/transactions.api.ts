import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type TransactionType = 'income' | 'expense'

export type Transaction = {
  id: string
  userId: string
  accountId: string
  accountName?: string | null
  categoryId: string
  categoryName?: string | null
  subcategoryId: string | null
  subcategoryName?: string | null
  type: TransactionType
  amount: number
  date: string
  description: string | null
  notes: string | null
  transferId: string | null
  createdAt: string
}

export type TransactionsListResponse = {
  data: Transaction[]
  page: number
  limit: number
  total: number
}

export type TransactionsQueryParams = {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
  accountId?: string
  categoryId?: string
  subcategoryId?: string
  type?: TransactionType
  description?: string
  notes?: string
  sort?:
    | 'date'
    | 'description'
    | 'account'
    | 'category'
    | 'subcategory'
    | 'type'
    | 'amount'
  dir?: 'asc' | 'desc'
}

export type TransactionsSummary = {
  income: number
  expense: number
  balance: number
}

export type TopCategoriesGroupBy = 'category' | 'subcategory'

export type TopCategory = {
  id: string
  name: string
  totalAmount: number
  percentage: number
  categoryId?: string
  categoryName?: string
}

export type TransactionsSummaryQueryParams = {
  startDate?: string
  endDate?: string
  accountId?: string
  categoryId?: string
  subcategoryId?: string
  type?: TransactionType
}

export type TopCategoriesQueryParams = {
  startDate?: string
  endDate?: string
  accountId?: string
  type?: TransactionType
  groupBy?: TopCategoriesGroupBy
}

export type TransactionDescriptionsQueryParams = {
  accountId: string
  q?: string
  limit?: number
}

export type TransactionDescriptionsResponse = {
  items: string[]
}

export type TransactionCreatePayload = {
  accountId: string
  categoryId: string
  subcategoryId?: string | null
  type: TransactionType
  amount: number
  date: string
  description?: string | null
  notes?: string | null
}

export type TransactionUpdatePayload = {
  accountId?: string
  categoryId?: string
  subcategoryId?: string | null
  type?: TransactionType
  amount?: number
  date?: string
  description?: string | null
  notes?: string | null
}

const transactionsKey = ['transactions']
const transactionKey = (id: string) => ['transaction', id]
const transactionsSummaryKey = ['transactions-summary']
const transactionsTopCategoriesKey = ['transactions-top-categories']
const transactionsDescriptionsKey = ['transactions-descriptions']

export function useTransactions(
  params: TransactionsQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...transactionsKey, params],
    queryFn: async () => {
      const response = await api.get<TransactionsListResponse>(
        '/transactions',
        {
          params,
        },
      )
      return response.data
    },
    enabled: options?.enabled,
  })
}

export function useTransactionsSummary(
  params: TransactionsSummaryQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...transactionsSummaryKey, params],
    queryFn: async () => {
      const response = await api.get<TransactionsSummary>(
        '/transactions/summary',
        { params },
      )
      return response.data
    },
    enabled: options?.enabled,
  })
}

export function useTransactionsTopCategories(
  params: TopCategoriesQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...transactionsTopCategoriesKey, params],
    queryFn: async () => {
      const response = await api.get<TopCategory[]>(
        '/transactions/top-categories',
        { params },
      )
      return response.data
    },
    enabled: options?.enabled,
  })
}

export function useTransactionDescriptions(
  params: TransactionDescriptionsQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...transactionsDescriptionsKey, params],
    queryFn: async () => {
      const response = await api.get<TransactionDescriptionsResponse>(
        '/transactions/descriptions',
        { params },
      )
      return response.data
    },
    enabled: options?.enabled,
  })
}

export function useTransaction(id?: string) {
  return useQuery({
    queryKey: id ? transactionKey(id) : ['transaction', 'missing'],
    queryFn: async () => {
      if (!id) {
        throw new Error('Transaction id is required.')
      }
      const response = await api.get<Transaction>(`/transactions/${id}`)
      return response.data
    },
    enabled: Boolean(id),
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: TransactionCreatePayload) => {
      const response = await api.post<Transaction>('/transactions', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsKey })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: transactionsSummaryKey })
      queryClient.invalidateQueries({ queryKey: transactionsTopCategoriesKey })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: TransactionUpdatePayload
    }) => {
      const response = await api.put<Transaction>(`/transactions/${id}`, payload)
      return response.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: transactionsKey })
      queryClient.invalidateQueries({ queryKey: transactionKey(variables.id) })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: transactionsSummaryKey })
      queryClient.invalidateQueries({ queryKey: transactionsTopCategoriesKey })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/transactions/${id}`)
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: transactionsKey })
      queryClient.invalidateQueries({ queryKey: transactionKey(id) })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: transactionsSummaryKey })
      queryClient.invalidateQueries({ queryKey: transactionsTopCategoriesKey })
    },
  })
}
