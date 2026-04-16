import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { CategoriesPage } from '@/features/categories/components/categories-page'
import {
  CATEGORY_TYPE_VALUES,
  isCategoryType,
} from '@/features/categories/model/categories.constants'

export const Route = createFileRoute('/app/categories')({
  validateSearch: z.object({
    q: z.string().optional(),
    type: z
      .preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return undefined
          }
          return isCategoryType(value) ? value : undefined
        },
        z.enum(CATEGORY_TYPE_VALUES),
      )
      .optional(),
  }),
  component: CategoriesRouteComponent,
})

function CategoriesRouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return <CategoriesPage search={search} navigate={navigate} />
}
