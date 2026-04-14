import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import type {
  TopCategoriesGroupBy,
  TopCategory,
} from '@/features/transactions/transactions.api'
import { formatCurrencyValue } from '@/lib/utils'

type DashboardTopCategoriesCardProps = {
  title: string
  icon: ReactNode
  isOpen: boolean
  groupBy: TopCategoriesGroupBy
  showSkeleton: boolean
  errorMessage: string | null
  emptyMessage: string
  items: TopCategory[]
  onToggleOpen: () => void
  onToggleGroupBySubcategory: (checked: boolean) => void
  onSelectItem: (item: TopCategory) => void
  viewAllAction: ReactNode
}

export function DashboardTopCategoriesCard({
  title,
  icon,
  isOpen,
  groupBy,
  showSkeleton,
  errorMessage,
  emptyMessage,
  items,
  onToggleOpen,
  onToggleGroupBySubcategory,
  onSelectItem,
  viewAllAction,
}: DashboardTopCategoriesCardProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onToggleOpen}
            aria-label={isOpen ? `Recolher ${title}` : `Expandir ${title}`}
          >
            {isOpen ? '-' : '+'}
          </Button>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {icon}
              {title}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOpen && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border sm:h-4 sm:w-4"
                checked={groupBy === 'subcategory'}
                onChange={(event) =>
                  onToggleGroupBySubcategory(event.target.checked)
                }
              />
              Subcategoria
            </label>
          )}
          {viewAllAction}
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-3">
          {showSkeleton &&
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`${title}-skeleton-${index}`}
                className="space-y-2 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-muted/60" />
                    <div className="h-3 w-20 rounded bg-muted/60" />
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-4 w-20 rounded bg-muted/60" />
                    <div className="h-3 w-12 rounded bg-muted/60" />
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/60" />
              </div>
            ))}
          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          {!showSkeleton && !errorMessage && items.length === 0 && (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          )}
          {!showSkeleton &&
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full space-y-2 rounded-md border border-transparent p-2 text-left transition hover:border-muted hover:bg-muted/30"
                onClick={() => onSelectItem(item)}
              >
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.categoryName && (
                      <p className="text-xs text-muted-foreground">
                        {item.categoryName}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="sensitive font-medium">
                      {formatCurrencyValue(item.totalAmount)}
                    </p>
                    <p className="sensitive text-xs text-muted-foreground">
                      {item.percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
