import type { AuditAction, AuditEntityType } from '@/features/audit'

export type AuditSearchParams = {
  page?: number
  limit?: number
  entityType?: AuditEntityType
  action?: AuditAction
  startDate?: string
  endDate?: string
}

type AuditNavigateSearch = {
  search: (previous: AuditSearchParams) => AuditSearchParams
  replace?: boolean
}

export type AuditNavigateFn = (options: AuditNavigateSearch) => void
