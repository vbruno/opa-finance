import type { AuditAction, AuditEntityType } from '@/features/audit'
import type {
  AuditNavigateFn,
  AuditSearchParams,
} from '@/features/audit/model/audit.types'

type UseAuditSearchParamsParams = {
  search: AuditSearchParams
  navigate: AuditNavigateFn
}

export function useAuditSearchParams({
  search,
  navigate,
}: UseAuditSearchParamsParams) {
  const page = search.page ?? 1
  const limit = search.limit ?? 20

  function setSearch(
    next: Partial<{
      page: number
      limit: number
      entityType: AuditEntityType | undefined
      action: AuditAction | undefined
      startDate: string | undefined
      endDate: string | undefined
    }>,
  ) {
    navigate({
      search: (prev) => ({
        ...prev,
        ...next,
      }),
    })
  }

  return {
    page,
    limit,
    setSearch,
  }
}
