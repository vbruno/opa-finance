import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type RecurrenceOriginType = 'transaction' | 'transfer'
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'
export type RecurrenceEndType = 'never' | 'by_occurrences' | 'until_date'
export type RecurrencePostingMode = 'automatic' | 'review_required'
export type RecurrenceStatus = 'active' | 'finalized'
export type RecurrenceOccurrenceStatus =
  | 'materialized'
  | 'failed'
  | 'pending_review'
  | 'skipped'
export type RecurrenceEditScope = 'single' | 'this_and_next' | 'all'
export type RecurrenceTimelineStatus = RecurrenceOccurrenceStatus | 'projected'

export type RecurrenceOccurrenceReviewPayload = {
  occurrenceDate: string
  originalScheduledDate: string
  originType: RecurrenceOriginType
  amount: number
  description: string | null
  notes: string | null
  accountId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  fromAccountId?: string | null
  toAccountId?: string | null
}

export type RecurrenceOccurrence = {
  id: string
  recurrenceId: string
  originType: RecurrenceOriginType
  occurrenceDate: string
  status: RecurrenceOccurrenceStatus
  transactionId: string | null
  transferId: string | null
  metadata: Record<string, unknown> | null
  reviewPayload: RecurrenceOccurrenceReviewPayload | null
  version: number
  createdAt: string
}

export type Recurrence = {
  id: string
  userId: string
  originType: RecurrenceOriginType
  status: RecurrenceStatus
  postingMode: RecurrencePostingMode
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
  pendingReviewCount?: number
}

export type RecurrenceTimelineItem = {
  id: string | null
  sequence: number | null
  occurrenceDate: string
  status: RecurrenceTimelineStatus
  source: 'persisted' | 'projected'
  amount: number
  transactionId: string | null
  transferId: string | null
  version: number | null
  reviewPayload: RecurrenceOccurrenceReviewPayload | null
  canConfirm: boolean
  canSkip: boolean
}

export type RecurrenceTimelineSummary = {
  totalOccurrences: number | null
  consumedOccurrences: number
  materializedOccurrences: number
  pendingReviewOccurrences: number
  skippedOccurrences: number
  failedOccurrences: number
  projectedOccurrences: number
  totalAmount: number | null
  materializedAmount: number
  pendingReviewAmount: number
  projectedAmount: number
  appliedLimit: number
  isPartial: boolean
  hasMoreProjected: boolean
  projectionWindowLabel: string | null
}

export type RecurrenceTimelinePagination = {
  page: number
  limit: number
  hasMore: boolean
  total: number | null
}

export type RecurrenceTimelineResponse = {
  recurrence: Recurrence
  summary: RecurrenceTimelineSummary
  items: RecurrenceTimelineItem[]
  pagination: RecurrenceTimelinePagination
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
  postingMode?: RecurrencePostingMode
  accountId?: string
  q?: string
}

export type RecurrenceBasePayload = {
  postingMode?: RecurrencePostingMode
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
  postingMode?: RecurrencePostingMode
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

export type RecurrenceTimelineQueryParams = {
  limit?: number
  page?: number
  dir?: 'asc' | 'desc'
  untilDate?: string
  includeProjected?: boolean
}

export type ConfirmRecurrenceOccurrencePayload = {
  expectedVersion: number
  occurrenceDate?: string
  amount?: number
  description?: string | null
  notes?: string | null
  accountId?: string
  categoryId?: string
  subcategoryId?: string | null
  fromAccountId?: string
  toAccountId?: string
}

export type SkipRecurrenceOccurrencePayload = {
  expectedVersion: number
  reason?: string
}

const recurrencesKey = ['recurrences']
const recurrenceKey = (id: string) => ['recurrence', id]

function invalidateRecurrenceDependentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: recurrencesKey })
  queryClient.invalidateQueries({ queryKey: ['recurrence-timeline'] })
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

export function useConfirmRecurrenceOccurrence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      occurrenceId,
      payload,
    }: {
      occurrenceId: string
      payload: ConfirmRecurrenceOccurrencePayload
    }) => {
      const response = await api.post(`/recurrences/occurrences/${occurrenceId}/confirm`, payload)
      return response.data
    },
    onSuccess: () => {
      invalidateRecurrenceDependentQueries(queryClient)
    },
  })
}

export function useSkipRecurrenceOccurrence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      occurrenceId,
      payload,
    }: {
      occurrenceId: string
      payload: SkipRecurrenceOccurrencePayload
    }) => {
      const response = await api.post(`/recurrences/occurrences/${occurrenceId}/skip`, payload)
      return response.data
    },
    onSuccess: () => {
      invalidateRecurrenceDependentQueries(queryClient)
    },
  })
}

export function useRecurrenceTimeline(
  id?: string,
  params?: RecurrenceTimelineQueryParams,
) {
  return useQuery({
    queryKey: id ? ['recurrence-timeline', id, params] : ['recurrence-timeline', 'missing'],
    queryFn: async () => {
      if (!id) {
        throw new Error('Recurrence id is required.')
      }
      const response = await api.get<RecurrenceTimelineResponse>(`/recurrences/${id}/timeline`, {
        params,
      })
      return response.data
    },
    enabled: Boolean(id),
  })
}
