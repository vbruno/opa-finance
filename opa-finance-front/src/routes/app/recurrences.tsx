import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { RecurrencesPage } from '@/features/recurrences/components/recurrences-page'
import {
  RECURRENCE_FREQUENCIES,
  RECURRENCE_ORIGIN_TYPES,
  RECURRENCE_STATUSES,
} from '@/features/recurrences/model/recurrences.constants'

export const Route = createFileRoute('/app/recurrences')({
  validateSearch: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    originType: z
      .preprocess(
        (value) =>
          typeof value === 'string' && RECURRENCE_ORIGIN_TYPES.includes(value as never)
            ? value
            : undefined,
        z.enum(RECURRENCE_ORIGIN_TYPES),
      )
      .optional(),
    status: z
      .preprocess(
        (value) =>
          typeof value === 'string' && RECURRENCE_STATUSES.includes(value as never)
            ? value
            : undefined,
        z.enum(RECURRENCE_STATUSES),
      )
      .optional(),
    frequency: z
      .preprocess(
        (value) =>
          typeof value === 'string' && RECURRENCE_FREQUENCIES.includes(value as never)
            ? value
            : undefined,
        z.enum(RECURRENCE_FREQUENCIES),
      )
      .optional(),
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
