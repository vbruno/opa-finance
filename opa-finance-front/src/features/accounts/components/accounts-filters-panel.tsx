import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ACCOUNT_TYPE_OPTIONS,
  isAccountType,
} from '@/features/accounts/model/accounts.constants'
import type { AccountsTypeFilter } from '@/features/accounts/model/accounts.types'

type AccountsFiltersPanelProps = {
  isFiltersOpen: boolean
  searchDraft: string
  typeFilter: AccountsTypeFilter
  hasActiveFilters: boolean
  onSearchDraftChange: (value: string) => void
  onSearchEnter: (value: string) => void
  onTypeFilterChange: (value: AccountsTypeFilter) => void
  onClearFilters: () => void
}

export function AccountsFiltersPanel({
  isFiltersOpen,
  searchDraft,
  typeFilter,
  hasActiveFilters,
  onSearchDraftChange,
  onSearchEnter,
  onTypeFilterChange,
  onClearFilters,
}: AccountsFiltersPanelProps) {
  return (
    <div
      className={`rounded-lg border bg-card p-4 ${
        isFiltersOpen ? 'block' : 'hidden'
      } desktop-force-block`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <h3 className="text-base font-semibold">Filtros</h3>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="w-full sm:min-w-[220px] sm:flex-1">
            <Input
              type="text"
              placeholder="Buscar por nome..."
              value={searchDraft}
              onChange={(event) => onSearchDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') {
                  return
                }
                onSearchEnter(event.currentTarget.value)
              }}
            />
          </div>
          <div className="flex w-full items-center gap-2 sm:contents">
            <div className="w-full sm:w-56">
              <div className="relative">
                <select
                  className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-10 text-sm"
                  value={typeFilter}
                  onChange={(event) => {
                    const value = event.target.value
                    onTypeFilterChange(value === '' ? '' : resolveAccountType(value))
                  }}
                >
                  <option value="">Todos</option>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M4 6l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
            <div className="flex h-10 items-center sm:w-auto sm:items-end sm:justify-end">
              <Button
                variant="destructive"
                size="icon"
                disabled={!hasActiveFilters}
                aria-label="Limpar filtros"
                className="h-10 w-10"
                onClick={onClearFilters}
              >
                x
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function resolveAccountType(value: string): AccountsTypeFilter {
  if (isAccountType(value)) {
    return value
  }
  return ''
}
