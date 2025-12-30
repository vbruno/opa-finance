import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type TransactionType = 'income' | 'expense'

export type Transaction = {
  id: string
  userId: string
  accountId: string
  categoryId: string
  subcategoryId: string | null
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

export function useTransactions(params: TransactionsQueryParams) {
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
    },
  })
}
