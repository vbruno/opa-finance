import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { WeeklyCashflowPage } from '@/features/weekly-cashflow/components/weekly-cashflow-page'

export const Route = createFileRoute('/app/weekly-cashflow')({
  validateSearch: z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    weekStart: z.enum(['monday', 'sunday']).optional(),
    accountIds: z.string().optional(),
  }),
  component: WeeklyCashflowRouteComponent,
})

function WeeklyCashflowRouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return <WeeklyCashflowPage search={search} navigate={navigate} />
}
