import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { AccountsPage } from '@/features/accounts/components/accounts-page'
import {
  ACCOUNTS_SORT_DIRECTION_VALUES,
  ACCOUNTS_SORT_VALUES,
  ACCOUNT_TYPE_VALUES,
  isAccountType,
  isAccountsSortDirection,
  isAccountsSortKey,
} from '@/features/accounts/model/accounts.constants'

export const Route = createFileRoute('/app/accounts')({
  validateSearch: z.object({
    q: z.string().optional(),
    type: z
      .preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return undefined
          }
          return isAccountType(value) ? value : undefined
        },
        z.enum(ACCOUNT_TYPE_VALUES),
      )
      .optional(),
    id: z.string().optional(),
    sort: z
      .preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return undefined
          }
          return isAccountsSortKey(value) ? value : undefined
        },
        z.enum(ACCOUNTS_SORT_VALUES),
      )
      .optional(),
    dir: z
      .preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return undefined
          }
          return isAccountsSortDirection(value) ? value : undefined
        },
        z.enum(ACCOUNTS_SORT_DIRECTION_VALUES),
      )
      .optional(),
    page: z
      .preprocess((value) => {
        const parsed = Number(value)
        if (!Number.isFinite(parsed) || parsed < 1) {
          return undefined
        }
        return Math.floor(parsed)
      }, z.number().int().min(1))
      .optional(),
  }),
  component: AccountsRouteComponent,
})

function AccountsRouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return <AccountsPage search={search} navigate={navigate} />
}
