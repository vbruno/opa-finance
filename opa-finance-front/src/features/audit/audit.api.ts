import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type AuditEntityType =
  | 'transaction'
  | 'account'
  | 'category'
  | 'subcategory'

export type AuditAction = 'create' | 'update' | 'delete'

export type AuditLog = {
  id: string
  userId: string
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  beforeData: Record<string, unknown> | null
  afterData: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  summary?: {
    screen?: string | null
    action?: string | null
    description?: string | null
    accountName?: string | null
    categoryName?: string | null
    subcategoryName?: string | null
  } | null
  beforeDataFriendly?: Record<string, string> | null
  afterDataFriendly?: Record<string, string> | null
  metadataFriendly?: Record<string, string> | null
  createdAt: string
}

export type AuditLogsResponse = {
  data: AuditLog[]
  page: number
  limit: number
  total: number
}

export type AuditLogsQueryParams = {
  page?: number
  limit?: number
  view?: 'raw' | 'grouped'
  entityType?: AuditEntityType
  action?: AuditAction
  startDate?: string
  endDate?: string
}

const auditLogsKey = ['audit-logs']

export function useAuditLogs(
  params: AuditLogsQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...auditLogsKey, params],
    queryFn: async () => {
      const response = await api.get<AuditLogsResponse>('/audit-logs', {
        params,
      })
      return response.data
    },
    enabled: options?.enabled,
  })
}
