import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type TransferCreatePayload = {
  fromAccountId: string
  toAccountId: string
  amount: number
  date: string
  description?: string | null
}

export type TransferResponse = {
  id: string
  fromAccount: {
    id: string
    accountId: string
  }
  toAccount: {
    id: string
    accountId: string
  }
}

export function useCreateTransfer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: TransferCreatePayload) => {
      const response = await api.post<TransferResponse>('/transfers', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
