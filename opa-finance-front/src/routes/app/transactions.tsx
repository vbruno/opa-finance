import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { TransactionsPage } from '@/features/transactions/components/transactions-page'
import {
  SORT_DIRECTION_VALUES,
  TRANSACTION_SORT_VALUES,
  TRANSACTION_TYPE_VALUES,
} from '@/features/transactions/model/transactions.constants'

export const Route = createFileRoute('/app/transactions')({
  validateSearch: z.object({
    page: z
      .preprocess((value) => {
        const parsed = Number(value)
        if (!Number.isFinite(parsed) || parsed < 1) {
          return undefined
        }
        return Math.floor(parsed)
      }, z.number().int().min(1))
      .optional(),
    limit: z
      .preprocess((value) => {
        const parsed = Number(value)
        if (!Number.isFinite(parsed) || parsed < 1) {
          return undefined
        }
        return Math.floor(parsed)
      }, z.number().int().min(1).max(100))
      .optional(),
    type: z
      .preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return undefined
          }
          return TRANSACTION_TYPE_VALUES.includes(
            value as (typeof TRANSACTION_TYPE_VALUES)[number],
          )
            ? value
            : undefined
        },
        z.enum(TRANSACTION_TYPE_VALUES),
      )
      .optional(),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    subcategoryId: z.string().optional(),
    description: z.string().optional(),
    includeNotes: z
      .preprocess((value) => {
        if (typeof value === 'boolean') {
          return value
        }
        if (value === 'true' || value === '1') {
          return true
        }
        if (value === 'false' || value === '0') {
          return false
        }
        return undefined
      }, z.boolean().optional())
      .optional(),
    notesOnly: z
      .preprocess((value) => {
        if (typeof value === 'boolean') {
          return value
        }
        if (value === 'true' || value === '1') {
          return true
        }
        if (value === 'false' || value === '0') {
          return false
        }
        return undefined
      }, z.boolean().optional())
      .optional(),
    amountMode: z
      .preprocess((value) => {
        if (typeof value === 'boolean') {
          return value
        }
        if (value === 'true' || value === '1') {
          return true
        }
        if (value === 'false' || value === '0') {
          return false
        }
        return undefined
      }, z.boolean().optional())
      .optional(),
    amount: z.string().optional(),
    sort: z
      .preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return undefined
          }
          return TRANSACTION_SORT_VALUES.includes(
            value as (typeof TRANSACTION_SORT_VALUES)[number],
          )
            ? value
            : undefined
        },
        z.enum(TRANSACTION_SORT_VALUES),
      )
      .optional(),
    dir: z
      .preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return undefined
          }
          return SORT_DIRECTION_VALUES.includes(
            value as (typeof SORT_DIRECTION_VALUES)[number],
          )
            ? value
            : undefined
        },
        z.enum(SORT_DIRECTION_VALUES),
      )
      .optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  component: TransactionsRoute,
})

function TransactionsRoute() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  return <TransactionsPage search={search} navigate={navigate} />
}
