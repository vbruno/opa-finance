import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type RecurrenceOriginType = 'transaction' | 'transfer'
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'
export type RecurrenceEndType = 'never' | 'by_occurrences' | 'until_date'
export type RecurrenceStatus = 'active' | 'finalized'
export type RecurrenceEditScope = 'single' | 'this_and_next' | 'all'

export type Recurrence = {
  id: string
  userId: string
  originType: RecurrenceOriginType
  status: RecurrenceStatus
  timezone: string
  frequency: RecurrenceFrequency
  startDate: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  monthOfYear: number | null
  endType: RecurrenceEndType
  endOccurrences: number | null
  endDate: string | null
  accountId: string | null
  categoryId: string | null
  subcategoryId: string | null
  fromAccountId: string | null
  toAccountId: string | null
  amount: number
  description: string | null
  notes: string | null
  nextOccurrenceDate: string
  lastMaterializedDate: string | null
  lastMaterializedAt: string | null
  finalizedAt: string | null
  deletedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type RecurrenceListResponse = {
  data: Recurrence[]
  page: number
  limit: number
  total: number
}

export type RecurrenceListQueryParams = {
  page?: number
  limit?: number
  originType?: RecurrenceOriginType
  status?: RecurrenceStatus
  frequency?: RecurrenceFrequency
  accountId?: string
  q?: string
}

export type RecurrenceBasePayload = {
  frequency: RecurrenceFrequency
  startDate: string
  dayOfWeek?: number
  dayOfMonth?: number
  monthOfYear?: number
  endType: RecurrenceEndType
  endOccurrences?: number
  endDate?: string
  amount: number
  description?: string
  notes?: string
}

export type RecurrenceCreatePayload =
  | (RecurrenceBasePayload & {
      originType: 'transaction'
      accountId: string
      categoryId: string
      subcategoryId?: string
    })
  | (RecurrenceBasePayload & {
      originType: 'transfer'
      fromAccountId: string
      toAccountId: string
    })

export type RecurrenceUpdatePayload = {
  frequency?: RecurrenceFrequency
  startDate?: string
  dayOfWeek?: number
  dayOfMonth?: number
  monthOfYear?: number
  endType?: RecurrenceEndType
  endOccurrences?: number
  endDate?: string
  amount?: number
  description?: string | null
  notes?: string | null
  accountId?: string
  categoryId?: string
  subcategoryId?: string | null
  fromAccountId?: string
  toAccountId?: string
  expectedVersion?: number
}

export type EditRecurrenceByScopePayload = {
  scope: RecurrenceEditScope
  occurrenceDate?: string
  changes: RecurrenceUpdatePayload
}

const recurrencesKey = ['recurrences']
const recurrenceKey = (id: string) => ['recurrence', id]

function invalidateRecurrenceDependentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: recurrencesKey })
  queryClient.invalidateQueries({ queryKey: ['transactions'] })
  queryClient.invalidateQueries({ queryKey: ['accounts'] })
  queryClient.invalidateQueries({ queryKey: ['weekly-cashflow'] })
  queryClient.invalidateQueries({ queryKey: ['consolidated'] })
}

export function useRecurrences(
  params: RecurrenceListQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...recurrencesKey, params],
    queryFn: async () => {
      const response = await api.get<RecurrenceListResponse>('/recurrences', {
        params,
      })
      return response.data
    },
    enabled: options?.enabled,
  })
}

export function useRecurrence(id?: string) {
  return useQuery({
    queryKey: id ? recurrenceKey(id) : ['recurrence', 'missing'],
    queryFn: async () => {
      if (!id) {
        throw new Error('Recurrence id is required.')
      }
      const response = await api.get<Recurrence>(`/recurrences/${id}`)
      return response.data
    },
    enabled: Boolean(id),
  })
}

export function useCreateRecurrence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: RecurrenceCreatePayload) => {
      const response = await api.post<Recurrence>('/recurrences', payload)
      return response.data
    },
    onSuccess: () => {
      invalidateRecurrenceDependentQueries(queryClient)
    },
  })
}

export function useUpdateRecurrence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: RecurrenceUpdatePayload
    }) => {
      const response = await api.put<Recurrence>(`/recurrences/${id}`, payload)
      return response.data
    },
    onSuccess: (_data, variables) => {
      invalidateRecurrenceDependentQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: recurrenceKey(variables.id) })
    },
  })
}

export function useEditRecurrenceByScope() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: EditRecurrenceByScopePayload
    }) => {
      const response = await api.put(
        `/recurrences/${id}/edit-scope`,
        payload,
      )
      return response.data
    },
    onSuccess: () => {
      invalidateRecurrenceDependentQueries(queryClient)
    },
  })
}

export function useFinalizeRecurrence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put<Recurrence>(`/recurrences/${id}/finalize`)
      return response.data
    },
    onSuccess: (_data, id) => {
      invalidateRecurrenceDependentQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: recurrenceKey(id) })
    },
  })
}

export function useDeleteRecurrence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/recurrences/${id}`)
    },
    onSuccess: () => {
      invalidateRecurrenceDependentQueries(queryClient)
    },
  })
}
