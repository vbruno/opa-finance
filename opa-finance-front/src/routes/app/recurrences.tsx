import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { RecurrencesPage } from '@/features/recurrences/components/recurrences-page'

export const Route = createFileRoute('/app/recurrences')({
  validateSearch: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    originType: z.enum(['transaction', 'transfer']).optional(),
    status: z.enum(['active', 'finalized']).optional(),
    frequency: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']).optional(),
    accountId: z.string().optional(),
    q: z.string().optional(),
  }),
  component: RecurrencesRouteComponent,
})

function RecurrencesRouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return <RecurrencesPage search={search} navigate={navigate} />
}
