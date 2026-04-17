import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { AuditPage } from '@/features/audit/components/audit-page'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
} from '@/features/audit/model/audit.constants'

export const Route = createFileRoute('/app/audit')({
  validateSearch: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    entityType: z
      .preprocess(
        (value) =>
          typeof value === 'string' && AUDIT_ENTITY_TYPES.includes(value as never)
            ? value
            : undefined,
        z.enum(AUDIT_ENTITY_TYPES),
      )
      .optional(),
    action: z
      .preprocess(
        (value) =>
          typeof value === 'string' && AUDIT_ACTIONS.includes(value as never)
            ? value
            : undefined,
        z.enum(AUDIT_ACTIONS),
      )
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  component: AuditRouteComponent,
})

function AuditRouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return <AuditPage search={search} navigate={navigate} />
}
