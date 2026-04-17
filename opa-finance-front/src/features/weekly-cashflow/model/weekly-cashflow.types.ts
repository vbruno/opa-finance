import type { WeekStart } from '@/features/reports'

export type WeeklyCashflowGroup = {
  id: string
  name: string
  columnIds: string[]
}

export type GroupDisplayMode = 'group' | 'children' | 'both'
export type SortDirection = 'asc' | 'desc'
export type WeeklySortKey =
  | 'week'
  | 'startDate'
  | 'endDate'
  | 'total'
  | 'received'
  | 'spent'
  | `dyn:${string}`

export type VisibleOrderedItem = { itemId: string; topLevelIndex: number }
export type VisibleTableItem = {
  itemId: string
  topLevelIndex: number
  kind: 'group' | 'column'
  valueType: 'income' | 'expense' | null
  label: string
}
export type OrderPanelItem =
  | {
      kind: 'group'
      itemId: string
      topLevelIndex: number
    }
  | {
      kind: 'column'
      itemId: string
      topLevelIndex: number
    }
  | {
      kind: 'group-child'
      itemId: string
      groupItemId: string
      topLevelIndex: number
    }

export type WeeklyCashflowViewState = {
  version: 1
  viewId: 'weekly-flow-default'
  year?: number
  weekStart?: WeekStart
  accountIds?: string[]
  selectedColumnIds?: string[]
  columnOrder?: string[]
  groups?: WeeklyCashflowGroup[]
  groupDisplayModes?: Record<string, GroupDisplayMode>
  separatorPositions?: number[]
  separatorPosition?: number | null
  sortDynamicByShare?: boolean
  updatedAt?: string
}

export type WeeklyCashflowSearch = {
  year?: number
  weekStart?: WeekStart
  accountIds?: string
}

export type WeeklyCashflowNavigate = (options: {
  search: (prev: WeeklyCashflowSearch) => WeeklyCashflowSearch
  replace?: boolean
}) => void
