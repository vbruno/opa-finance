import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { DashboardPage } from '@/features/dashboard/components/dashboard-page'
import {
  DASHBOARD_PERIOD_VALUES,
  isDashboardPeriod,
} from '@/features/dashboard/model/dashboard.constants'

export const Route = createFileRoute('/app/')({
  validateSearch: z.object({
    period: z
      .preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return undefined
          }
          return isDashboardPeriod(value) ? value : undefined
        },
        z.enum(DASHBOARD_PERIOD_VALUES),
      )
      .optional(),
    accountId: z.string().optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  component: DashboardRouteComponent,
})

function DashboardRouteComponent() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  return <DashboardPage search={search} navigate={navigate} />
}
