import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type Account = {
  id: string
  name: string
  type: string
  currentBalance: number
  isPrimary?: boolean
  createdAt: string
  updatedAt: string
}

export type AccountPayload = {
  name: string
  type: string
}

const accountsKey = ['accounts']

export function useAccounts() {
  return useQuery({
    queryKey: accountsKey,
    queryFn: async () => {
      const response = await api.get<Account[]>('/accounts')
      return response.data.map((account) => ({
        ...account,
        currentBalance:
          account.currentBalance === undefined ||
          account.currentBalance === null
            ? 0
            : Number(account.currentBalance),
      }))
    },
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: AccountPayload) => {
      const response = await api.post<Account>('/accounts', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: AccountPayload
    }) => {
      const response = await api.put<Account>(`/accounts/${id}`, payload)
      return response.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: accountsKey })
      queryClient.invalidateQueries({ queryKey: ['account', variables.id] })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/accounts/${id}`)
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: accountsKey })
      queryClient.invalidateQueries({ queryKey: ['account', id] })
    },
  })
}
