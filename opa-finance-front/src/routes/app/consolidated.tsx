import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { ConsolidatedPage } from '@/features/consolidated/components/consolidated-page'
import {
  CONSOLIDATED_MAX_YEAR,
  CONSOLIDATED_MIN_YEAR,
} from '@/features/consolidated/model/consolidated.constants'

export const Route = createFileRoute('/app/consolidated')({
  validateSearch: z.object({
    year: z.coerce
      .number()
      .int()
      .min(CONSOLIDATED_MIN_YEAR)
      .max(CONSOLIDATED_MAX_YEAR)
      .optional(),
    accountIds: z.string().optional(),
  }),
  component: ConsolidatedRouteComponent,
})

function ConsolidatedRouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return <ConsolidatedPage search={search} navigate={navigate} />
}
