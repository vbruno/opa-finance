import { createFileRoute } from '@tanstack/react-router'
import { CalendarRange, ChevronDown, Settings2 } from 'lucide-react'
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
import { useAccounts } from '@/features/accounts'
import { getUser } from '@/features/auth'
import {
  useTrialBalanceYears,
  useWeeklyCashflow,
  type WeekStart,
} from '@/features/reports'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'

type WeeklyCashflowGroup = {
  id: string
  name: string
  columnIds: string[]
}

type GroupDisplayMode = 'group' | 'children' | 'both'
type VisibleOrderedItem = { itemId: string; topLevelIndex: number }
type VisibleTableItem = {
  itemId: string
  topLevelIndex: number
  kind: 'group' | 'column'
  label: string
}
type OrderPanelItem =
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

type WeeklyCashflowViewState = {
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
  updatedAt?: string
}

const VIEW_STATE_VERSION = 1
const VIEW_ID = 'weekly-flow-default'
const GROUP_ITEM_PREFIX = 'group:'

export const Route = createFileRoute('/app/weekly-cashflow')({
  validateSearch: z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    weekStart: z.enum(['monday', 'sunday']).optional(),
    accountIds: z.string().optional(),
  }),
  component: WeeklyCashflowPage,
})

function WeeklyCashflowPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const isDesktop = useMediaQuery('(min-width: 960px)')
  const userId = getUser()?.id ?? 'anonymous'
  const storageKey = `opa:weekly-flow:view-state:${userId}`
  const currentYear = new Date().getFullYear()
  const todayIso = useMemo(() => getLocalIsoDate(new Date()), [])

  const persistedViewState = useMemo(
    () => loadWeeklyCashflowViewState(storageKey),
    [storageKey],
  )

  const year = search.year ?? persistedViewState?.year ?? currentYear
  const weekStart =
    search.weekStart ?? persistedViewState?.weekStart ?? ('monday' as WeekStart)

  const accountsQuery = useAccounts()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const allAccountIds = useMemo(() => accounts.map((account) => account.id), [accounts])
  const primaryAccountId = useMemo(() => {
    const primary = accounts.find((account) => account.isPrimary)
    return primary?.id ?? accounts[0]?.id ?? null
  }, [accounts])

  const selectedAccountIds = useMemo(() => {
    const idsFromSearch = search.accountIds
      ? search.accountIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : []
    const sourceIds =
      idsFromSearch.length > 0 ? idsFromSearch : (persistedViewState?.accountIds ?? [])
    const validIds = new Set(allAccountIds)
    const sanitized = sourceIds.filter((id) => validIds.has(id))

    if (sanitized.length > 0) {
      return Array.from(new Set(sanitized))
    }
    if (primaryAccountId) {
      return [primaryAccountId]
    }
    return []
  }, [
    allAccountIds,
    persistedViewState?.accountIds,
    primaryAccountId,
    search.accountIds,
  ])

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false)
  const accountDropdownRef = useRef<HTMLDivElement | null>(null)

  const [isColumnsConfigOpen, setIsColumnsConfigOpen] = useState(false)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [columnSearch, setColumnSearch] = useState('')
  const deferredColumnSearch = useDeferredValue(columnSearch)
  const [columnTypeFilter, setColumnTypeFilter] = useState<
    'all' | 'income' | 'expense'
  >('all')
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(
    persistedViewState?.selectedColumnIds ?? [],
  )
  const [columnOrder, setColumnOrder] = useState<string[]>(
    persistedViewState?.columnOrder ?? [],
  )
  const [groups, setGroups] = useState<WeeklyCashflowGroup[]>(
    persistedViewState?.groups ?? [],
  )
  const [groupDisplayModes, setGroupDisplayModes] = useState<
    Record<string, GroupDisplayMode>
  >(
    persistedViewState?.groupDisplayModes ?? {},
  )
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColumnIds, setNewGroupColumnIds] = useState<string[]>([])
  const [separatorPositions, setSeparatorPositions] = useState<number[]>(
    normalizeSeparatorPositions(
      persistedViewState?.separatorPositions,
      persistedViewState?.separatorPosition,
    ),
  )
  const yearsQuery = useTrialBalanceYears(
    {
      accountIds: selectedAccountIds.length ? selectedAccountIds : undefined,
    },
    {
      enabled: isDesktop && selectedAccountIds.length > 0,
    },
  )
  const yearOptions = useMemo(() => yearsQuery.data?.years ?? [], [yearsQuery.data?.years])
  const hasSelectedYear = yearOptions.includes(year)
  const activeYear =
    hasSelectedYear || yearOptions.length === 0 ? year : yearOptions[0]

  const weeklyCashflowQuery = useWeeklyCashflow(
    {
      year: activeYear,
      weekStart,
      accountIds: selectedAccountIds.length ? selectedAccountIds : undefined,
    },
    {
      enabled:
        isDesktop &&
        selectedAccountIds.length > 0 &&
        !yearsQuery.isLoading &&
        yearOptions.length > 0 &&
        hasSelectedYear,
    },
  )

  const columnsCatalog = useMemo(
    () => weeklyCashflowQuery.data?.columnsCatalog ?? [],
    [weeklyCashflowQuery.data?.columnsCatalog],
  )
  const columnsCatalogById = useMemo(
    () => new Map(columnsCatalog.map((column) => [column.id, column])),
    [columnsCatalog],
  )

  const selectedColumnsOrdered = useMemo(() => {
    const selectedSet = new Set(selectedColumnIds)
    const orderedFromState = columnOrder.filter((id) => selectedSet.has(id))
    const missingIds = selectedColumnIds.filter((id) => !orderedFromState.includes(id))
    return [...orderedFromState, ...missingIds].filter((id) => columnsCatalogById.has(id))
  }, [columnOrder, columnsCatalogById, selectedColumnIds])
  const groupsNormalized = useMemo(
    () =>
      groups
        .filter((group) => group.name.trim().length > 0 && group.columnIds.length >= 2)
        .map((group) => ({
          ...group,
          itemId: `${GROUP_ITEM_PREFIX}${group.id}`,
        })),
    [groups],
  )
  const groupsByItemId = useMemo(
    () => new Map(groupsNormalized.map((group) => [group.itemId, group])),
    [groupsNormalized],
  )
  const groupedColumnOwnerById = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of groupsNormalized) {
      for (const columnId of group.columnIds) {
        if (!map.has(columnId)) {
          map.set(columnId, group.itemId)
        }
      }
    }
    return map
  }, [groupsNormalized])
  const orderedItems = useMemo(() => {
    const validIds = new Set<string>([
      ...selectedColumnsOrdered,
      ...groupsNormalized.map((group) => group.itemId),
    ])
    const fromState = columnOrder.filter((id) => validIds.has(id))
    const missingColumns = selectedColumnsOrdered.filter((id) => !fromState.includes(id))
    const missingGroups = groupsNormalized
      .map((group) => group.itemId)
      .filter((id) => !fromState.includes(id))
    return [...fromState, ...missingColumns, ...missingGroups]
  }, [columnOrder, groupsNormalized, selectedColumnsOrdered])
  const visibleOrderedItems = useMemo<VisibleOrderedItem[]>(() => {
    const visible: VisibleOrderedItem[] = []
    for (let index = 0; index < orderedItems.length; index += 1) {
      const itemId = orderedItems[index]
      const group = groupsByItemId.get(itemId)
      if (group) {
        const mode = groupDisplayModes[group.id] ?? 'group'
        if (mode === 'group' || mode === 'both') {
          visible.push({ itemId, topLevelIndex: index })
        }
        if (mode === 'children' || mode === 'both') {
          for (const columnId of group.columnIds) {
            if (selectedColumnsOrdered.includes(columnId)) {
              visible.push({ itemId: columnId, topLevelIndex: index })
            }
          }
        }
        continue
      }
      if (groupedColumnOwnerById.has(itemId)) {
        continue
      }
      visible.push({ itemId, topLevelIndex: index })
    }
    return visible
  }, [
    groupDisplayModes,
    groupedColumnOwnerById,
    groupsByItemId,
    orderedItems,
    selectedColumnsOrdered,
  ])
  const visibleTableItems = useMemo<VisibleTableItem[]>(() => {
    const items: VisibleTableItem[] = []
    for (const { itemId, topLevelIndex } of visibleOrderedItems) {
      const group = groupsByItemId.get(itemId)
      if (group) {
        const safeGroupName = group.name.trim() || 'Grupo'
        items.push({
          itemId,
          topLevelIndex,
          kind: 'group',
          label: safeGroupName,
        })
        continue
      }

      const column = columnsCatalogById.get(itemId)
      if (!column) {
        continue
      }

      const ownerGroupItemId = groupedColumnOwnerById.get(itemId)
      const ownerGroup = ownerGroupItemId
        ? groupsByItemId.get(ownerGroupItemId)
        : undefined
      const baseLabel =
        column.label.trim() ||
        column.subcategoryName?.trim() ||
        column.categoryName.trim() ||
        'Sem titulo'
      const label = ownerGroup ? `${ownerGroup.name}: ${baseLabel}` : baseLabel

      items.push({
        itemId,
        topLevelIndex,
        kind: 'column',
        label,
      })
    }
    return items
  }, [
    columnsCatalogById,
    groupedColumnOwnerById,
    groupsByItemId,
    visibleOrderedItems,
  ])
  const orderPanelItems = useMemo<OrderPanelItem[]>(() => {
    const items: OrderPanelItem[] = []

    for (let index = 0; index < orderedItems.length; index += 1) {
      const itemId = orderedItems[index]
      const group = groupsByItemId.get(itemId)

      if (group) {
        items.push({ kind: 'group', itemId, topLevelIndex: index })
        for (const columnId of group.columnIds) {
          if (selectedColumnsOrdered.includes(columnId) && columnsCatalogById.has(columnId)) {
            items.push({
              kind: 'group-child',
              itemId: columnId,
              groupItemId: itemId,
              topLevelIndex: index,
            })
          }
        }
        continue
      }

      if (groupedColumnOwnerById.has(itemId)) {
        continue
      }

      if (columnsCatalogById.has(itemId)) {
        items.push({ kind: 'column', itemId, topLevelIndex: index })
      }
    }

    return items
  }, [columnsCatalogById, groupedColumnOwnerById, groupsByItemId, orderedItems, selectedColumnsOrdered])

  const filteredCatalog = useMemo(() => {
    const term = deferredColumnSearch.trim().toLowerCase()
    return columnsCatalog.filter((column) => {
      if (columnTypeFilter !== 'all' && column.type !== columnTypeFilter) {
        return false
      }

      if (!term) {
        return true
      }

      const label = `${column.label} ${column.categoryName} ${column.subcategoryName ?? ''}`
      return label.toLowerCase().includes(term)
    })
  }, [deferredColumnSearch, columnTypeFilter, columnsCatalog])

  const allDynamicColumnIds = useMemo(
    () => columnsCatalog.map((column) => column.id),
    [columnsCatalog],
  )
  const weeks = useMemo(
    () => (weeklyCashflowQuery.data?.weeks ?? []).slice(0, 52),
    [weeklyCashflowQuery.data?.weeks],
  )
  const selectedNewGroupType = useMemo(() => {
    if (newGroupColumnIds.length === 0) {
      return null
    }
    const firstSelected = columnsCatalogById.get(newGroupColumnIds[0])
    return firstSelected?.type ?? null
  }, [columnsCatalogById, newGroupColumnIds])
  const summary = useMemo(() => {
    const totals = weeks.reduce(
      (acc, week) => {
        acc.total += week.total
        acc.received += week.received
        acc.spent += week.spent
        return acc
      },
      { total: 0, received: 0, spent: 0 },
    )

    const bestWeek = weeks.reduce(
      (best, week) => (best === null || week.total > best.total ? week : best),
      null as (typeof weeks)[number] | null,
    )
    const worstWeek = weeks.reduce(
      (worst, week) => (worst === null || week.total < worst.total ? week : worst),
      null as (typeof weeks)[number] | null,
    )
    const weeksUntilNow = weeks.filter((week) => week.startDate <= todayIso)
    const averageUntilNow =
      weeksUntilNow.length > 0
        ? Number(
            (
              weeksUntilNow.reduce((sum, week) => sum + week.total, 0) /
              weeksUntilNow.length
            ).toFixed(2),
          )
        : 0

    return {
      total: Number(totals.total.toFixed(2)),
      received: Number(totals.received.toFixed(2)),
      spent: Number(totals.spent.toFixed(2)),
      bestWeek,
      worstWeek,
      averageUntilNow,
      weeksUntilNowCount: weeksUntilNow.length,
    }
  }, [todayIso, weeks])
  const inconsistentWeeks = useMemo(
    () =>
      weeks.filter(
        (week) => Math.abs(week.total - (week.received - week.spent)) > 0.01,
      ),
    [weeks],
  )

  const setSearch = useCallback(
    (
      next: Partial<{
        year: number
        weekStart: WeekStart
        accountIds: string | undefined
      }>,
    ) => {
      navigate({
        search: (prev) => ({
          ...prev,
          ...next,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  function updateSelectedAccounts(nextIds: string[]) {
    const validIds = nextIds.filter((id) => allAccountIds.includes(id))
    if (validIds.length === 0) {
      setSearch({ accountIds: primaryAccountId ?? undefined })
      return
    }
    setSearch({ accountIds: validIds.join(',') })
  }

  function toggleAccount(accountId: string) {
    const selectedSet = new Set(selectedAccountIds)
    if (selectedSet.has(accountId)) {
      selectedSet.delete(accountId)
    } else {
      selectedSet.add(accountId)
    }
    updateSelectedAccounts(allAccountIds.filter((id) => selectedSet.has(id)))
  }

  function toggleDynamicColumn(columnId: string, checked: boolean) {
    startTransition(() => {
      setSelectedColumnIds((previous) => {
        if (checked) {
          if (previous.includes(columnId)) {
            return previous
          }
          return [...previous, columnId]
        }
        return previous.filter((id) => id !== columnId)
      })

      setColumnOrder((previous) => {
        if (checked) {
          if (previous.includes(columnId)) {
            return previous
          }
          return [...previous, columnId]
        }
        return previous.filter((id) => id !== columnId)
      })
    })
  }

  function moveOrderItem(itemId: string, direction: 'up' | 'down') {
    setColumnOrder((previous) => {
      const validIds = new Set<string>([
        ...selectedColumnsOrdered,
        ...groupsNormalized.map((group) => group.itemId),
      ])
      const current = previous.filter((id) => validIds.has(id))
      const index = current.indexOf(itemId)
      if (index < 0) {
        return previous
      }
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= current.length) {
        return previous
      }
      const next = [...current]
      const temp = next[index]
      next[index] = next[target]
      next[target] = temp
      return next
    })
  }

  function toggleNewGroupColumn(columnId: string, checked: boolean) {
    setNewGroupColumnIds((previous) => {
      if (checked) {
        if (previous.includes(columnId)) {
          return previous
        }
        return [...previous, columnId]
      }
      return previous.filter((id) => id !== columnId)
    })
  }

  function createGroup() {
    const name = newGroupName.trim()
    const uniqueColumnIds = Array.from(new Set(newGroupColumnIds))
    if (!name || uniqueColumnIds.length < 2) {
      return
    }
    const selectedTypes = new Set(
      uniqueColumnIds
        .map((columnId) => columnsCatalogById.get(columnId)?.type)
        .filter((type): type is 'income' | 'expense' => Boolean(type)),
    )
    if (selectedTypes.size !== 1) {
      return
    }
    const hasOverlappingColumns = uniqueColumnIds.some((columnId) =>
      groupedColumnOwnerById.has(columnId),
    )
    if (hasOverlappingColumns) {
      return
    }
    const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setGroups((previous) => [...previous, { id, name, columnIds: uniqueColumnIds }])
    setColumnOrder((previous) => [...previous, `${GROUP_ITEM_PREFIX}${id}`])
    setNewGroupName('')
    setNewGroupColumnIds([])
    setIsCreateGroupOpen(false)
  }

  function removeGroup(groupId: string) {
    const itemId = `${GROUP_ITEM_PREFIX}${groupId}`
    setColumnOrder((previous) => previous.filter((id) => id !== itemId))
    setGroups((previous) => previous.filter((group) => group.id !== groupId))
    setGroupDisplayModes((previous) => {
      if (!(groupId in previous)) {
        return previous
      }
      const next = { ...previous }
      delete next[groupId]
      return next
    })
  }

  function cycleGroupDisplayMode(groupId: string) {
    setGroupDisplayModes((previous) => {
      const current = previous[groupId] ?? 'group'
      const nextMode: GroupDisplayMode =
        current === 'group' ? 'children' : current === 'children' ? 'both' : 'group'
      return { ...previous, [groupId]: nextMode }
    })
  }

  function addSeparatorItem() {
    if (orderedItems.length < 2) {
      return
    }
    const maxPosition = orderedItems.length - 1
    setSeparatorPositions((previous) => {
      const occupied = new Set(previous)
      for (let position = 1; position <= maxPosition; position += 1) {
        if (!occupied.has(position)) {
          return [...previous, position].sort((a, b) => a - b)
        }
      }
      return previous
    })
  }

  function removeSeparatorItem(position: number) {
    setSeparatorPositions((previous) =>
      previous.filter((current) => current !== position),
    )
  }

  function moveSeparatorItem(position: number, direction: 'up' | 'down') {
    setSeparatorPositions((previous) => {
      if (!previous.includes(position)) {
        return previous
      }
      const maxPosition = Math.max(1, selectedColumnsOrdered.length - 1)
      const target = direction === 'up' ? position - 1 : position + 1
      if (target < 1 || target > maxPosition) {
        return previous
      }
      if (previous.includes(target)) {
        return previous
      }
      return previous
        .map((current) => (current === position ? target : current))
        .sort((a, b) => a - b)
    })
  }

  useEffect(() => {
    const validCatalogIds = new Set(columnsCatalog.map((column) => column.id))
    const validGroupItemIds = new Set(
      groups
        .filter((group) => group.name.trim().length > 0 && group.columnIds.length >= 2)
        .map((group) => `${GROUP_ITEM_PREFIX}${group.id}`),
    )
    const validOrderItemIds = new Set<string>([
      ...validCatalogIds,
      ...validGroupItemIds,
    ])

    setSelectedColumnIds((previous) => {
      const next = previous.filter((columnId) => validCatalogIds.has(columnId))
      return areArraysEqual(previous, next) ? previous : next
    })

    setColumnOrder((previous) => {
      const next = previous.filter((itemId) => validOrderItemIds.has(itemId))
      return areArraysEqual(previous, next) ? previous : next
    })

    setGroups((previous) => {
      const next = previous
        .map((group) => ({
          ...group,
          columnIds: group.columnIds.filter((columnId) => validCatalogIds.has(columnId)),
        }))
        .filter((group) => group.columnIds.length >= 2)
      return areGroupsEqual(previous, next) ? previous : next
    })

    setNewGroupColumnIds((previous) => {
      const next = previous.filter(
        (columnId) =>
          validCatalogIds.has(columnId) && !groupedColumnOwnerById.has(columnId),
      )
      return areArraysEqual(previous, next) ? previous : next
    })

    setGroupDisplayModes((previous) => {
      const validGroupIds = new Set(
        groups
          .filter((group) => group.name.trim().length > 0 && group.columnIds.length >= 2)
          .map((group) => group.id),
      )
      const next = Object.fromEntries(
        Object.entries(previous).filter(([groupId, mode]) => {
          return validGroupIds.has(groupId) && isGroupDisplayMode(mode)
        }),
      ) as Record<string, GroupDisplayMode>
      return areGroupDisplayModesEqual(previous, next) ? previous : next
    })
  }, [columnsCatalog, groupedColumnOwnerById, groups])

  useEffect(() => {
    if (orderedItems.length < 2) {
      if (separatorPositions.length > 0) {
        setSeparatorPositions([])
      }
      return
    }

    const maxPosition = orderedItems.length - 1
    const normalized = Array.from(
      new Set(
        separatorPositions.filter(
          (position) => position >= 1 && position <= maxPosition,
        ),
      ),
    ).sort((a, b) => a - b)

    if (normalized.length !== separatorPositions.length ||
      normalized.some((position, index) => position !== separatorPositions[index])) {
      setSeparatorPositions(normalized)
    }
  }, [orderedItems.length, separatorPositions])

  useEffect(() => {
    if (yearOptions.length === 0) {
      return
    }
    if (yearOptions.includes(year)) {
      return
    }
    setSearch({ year: yearOptions[0] })
  }, [setSearch, year, yearOptions])

  useEffect(() => {
    if (!isAccountDropdownOpen) {
      return
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAccountDropdownOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsAccountDropdownOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isAccountDropdownOpen])

  useEffect(() => {
    if (!isColumnsConfigOpen) {
      setIsCreateGroupOpen(false)
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsColumnsConfigOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isColumnsConfigOpen])

  useEffect(() => {
    if (!isCreateGroupOpen) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsCreateGroupOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isCreateGroupOpen])

  useEffect(() => {
    if (!isSummaryOpen) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsSummaryOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isSummaryOpen])

  useEffect(() => {
    const payload: WeeklyCashflowViewState = {
      version: VIEW_STATE_VERSION,
      viewId: VIEW_ID,
      year,
      weekStart,
      accountIds: selectedAccountIds,
      selectedColumnIds,
      columnOrder,
      groups,
      groupDisplayModes,
      separatorPositions,
      updatedAt: new Date().toISOString(),
    }
    saveWeeklyCashflowViewState(storageKey, payload)
  }, [
    columnOrder,
    groupDisplayModes,
    groups,
    separatorPositions,
    selectedAccountIds,
    selectedColumnIds,
    storageKey,
    weekStart,
    year,
  ])

  if (!isDesktop) {
    return (
      <div className="rounded-md border p-4">
        <h1 className="text-lg font-semibold">Fluxo Semanal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A visualização de fluxo semanal está disponível na versão desktop.
        </p>
      </div>
    )
  }

  const isAllAccountsSelected =
    allAccountIds.length > 0 && selectedAccountIds.length === allAccountIds.length
  const selectedAccountLabel = isAllAccountsSelected
    ? 'Todas as contas'
    : selectedAccountIds.length === 1
      ? accounts.find((account) => account.id === selectedAccountIds[0])?.name ?? 'Conta'
      : `${selectedAccountIds.length} contas`

  const showEmptyColumnsHint = orderedItems.length === 0
  const hasNoAccounts = !accountsQuery.isLoading && allAccountIds.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md border p-2">
            <CalendarRange className="size-4" />
          </div>
          <h1 className="text-2xl font-bold">Fluxo Semanal</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Select
              value={String(activeYear)}
              onValueChange={(value) => setSearch({ year: Number(value) })}
              disabled={yearsQuery.isLoading || yearOptions.length === 0}
            >
              <SelectTrigger className="h-8 w-[108px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((optionYear) => (
                  <SelectItem key={optionYear} value={String(optionYear)}>
                    {optionYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={weekStart}
              onValueChange={(value) =>
                setSearch({ weekStart: value as WeekStart })
              }
            >
              <SelectTrigger className="h-8 w-[132px]">
                <SelectValue placeholder="Semana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monday">Segunda</SelectItem>
                <SelectItem value="sunday">Domingo</SelectItem>
              </SelectContent>
            </Select>

            <div ref={accountDropdownRef} className="relative">
              <button
                type="button"
                className="flex h-8 min-w-[220px] items-center justify-between rounded-md border px-3 text-sm"
                onClick={() =>
                  setIsAccountDropdownOpen((currentOpen) => !currentOpen)
                }
                aria-expanded={isAccountDropdownOpen}
              >
                <span className="truncate">{selectedAccountLabel}</span>
                <ChevronDown
                  className={`ml-2 size-4 text-muted-foreground ${isAccountDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isAccountDropdownOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border bg-background p-2 shadow-lg">
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={isAllAccountsSelected}
                      onChange={(event) =>
                        updateSelectedAccounts(
                          event.target.checked ? allAccountIds : [],
                        )
                      }
                    />
                    <span>Todas as contas</span>
                  </label>

                  <div className="my-2 border-t" />

                  <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {accounts.map((account) => (
                      <label
                        key={account.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={selectedAccountIds.includes(account.id)}
                          onChange={() => toggleAccount(account.id)}
                        />
                        <span className="truncate">
                          {account.name}
                          {account.isPrimary ? ' (principal)' : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mx-1 h-6 w-px bg-border/70" />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSummaryOpen(true)}
              disabled={!weeklyCashflowQuery.data || weeklyCashflowQuery.isLoading}
            >
              Resumo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsColumnsConfigOpen((current) => !current)}
            >
              <Settings2 className="mr-2 size-4" />
              Configurar colunas
            </Button>
          </div>
        </div>
      </div>

      {isColumnsConfigOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsColumnsConfigOpen(false)}
          />
          <div className="relative w-full max-w-5xl rounded-lg border bg-background p-3 shadow-lg sm:p-4">
            <div className="mb-3">
              <div>
                <h3 className="text-base font-semibold">Configurar colunas dinâmicas</h3>
                <p className="text-xs text-muted-foreground">
                  Escolha as colunas e ajuste a ordem de exibição.
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.3fr_auto_1fr]">
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                  <Input
                    value={columnSearch}
                    onChange={(event) => setColumnSearch(event.target.value)}
                    placeholder="Buscar coluna por nome..."
                  />
                  <Select
                    value={columnTypeFilter}
                    onValueChange={(value) =>
                      setColumnTypeFilter(value as 'all' | 'income' | 'expense')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="income">Receitas</SelectItem>
                      <SelectItem value="expense">Gastos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="h-[58dvh] space-y-1 overflow-y-auto rounded-md border p-2">
                  {filteredCatalog.map((column) => (
                    <label
                      key={column.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedColumnIds.includes(column.id)}
                          onChange={(event) =>
                            toggleDynamicColumn(column.id, event.target.checked)
                          }
                        />
                        <span>
                          {column.label}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({column.type === 'income' ? 'receita' : 'gasto'})
                          </span>
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {column.categoryName}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div
                aria-hidden="true"
                className="hidden w-px bg-border/70 lg:block"
              />

              <div className="space-y-2">
                <div className="flex h-10 items-center justify-between gap-2">
                  <ShortcutTooltip label="M1: grupo | M2: filhos | M3: grupo + filhos">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreateGroupOpen(true)}
                    >
                      Novo grupo
                    </Button>
                  </ShortcutTooltip>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        startTransition(() => {
                          setSelectedColumnIds(allDynamicColumnIds)
                          setColumnOrder(allDynamicColumnIds)
                        })
                      }}
                      disabled={allDynamicColumnIds.length === 0}
                    >
                      Selecionar todas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        startTransition(() => {
                          setSelectedColumnIds([])
                          setColumnOrder([])
                          setGroups([])
                          setGroupDisplayModes({})
                          setSeparatorPositions([])
                          setNewGroupColumnIds([])
                          setNewGroupName('')
                        })
                        setIsCreateGroupOpen(false)
                      }}
                      disabled={
                        selectedColumnIds.length === 0 &&
                        groups.length === 0 &&
                        separatorPositions.length === 0
                      }
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
                <div className="h-[58dvh] space-y-1 overflow-y-auto rounded-md border p-2">
                  <div className="flex items-center justify-between px-1 pb-1">
                    <p className="text-xs text-muted-foreground">Ordem selecionada</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={addSeparatorItem}
                      disabled={
                        orderedItems.length < 2 ||
                        separatorPositions.length >= orderedItems.length - 1
                      }
                    >
                      + Separador
                    </Button>
                  </div>
                  {orderedItems.length === 0 ? (
                    <p className="px-2 py-2 text-sm text-muted-foreground">
                      Nenhuma coluna selecionada.
                    </p>
                  ) : (
                    orderPanelItems.map((panelItem) => {
                      const group =
                        panelItem.kind === 'group'
                          ? groupsByItemId.get(panelItem.itemId)
                          : null
                      const isGroupChild = panelItem.kind === 'group-child'
                      const column =
                        panelItem.kind === 'group'
                          ? null
                          : columnsCatalogById.get(panelItem.itemId)
                      if (!group && !column) {
                        return null
                      }
                      const rowLabel = group
                        ? group.name
                        : `${isGroupChild ? '↳ ' : ''}${column?.label ?? '-'}`
                      const rowTypeLabel = group
                        ? 'grupo'
                        : column?.type === 'income'
                          ? 'receita'
                          : 'gasto'
                      const rowRightLabel =
                        group
                          ? `${group.columnIds.length} itens`
                          : panelItem.kind === 'group-child' && panelItem.groupItemId
                            ? `${groupsByItemId.get(panelItem.groupItemId)?.name ?? ''} · ${
                                column?.categoryName ?? '-'
                              }`
                            : column?.categoryName ?? '-'
                      const groupMode = group
                        ? groupDisplayModes[group.id] ?? 'group'
                        : null
                      const groupModeLabel =
                        groupMode === 'group'
                          ? 'M1'
                          : groupMode === 'children'
                            ? 'M2'
                            : groupMode === 'both'
                              ? 'M3'
                              : ''
                      const showSeparator =
                        panelItem.kind !== 'group-child' &&
                        separatorPositions.includes(panelItem.topLevelIndex)
                      const isFirstTopLevelRow =
                        panelItem.kind !== 'group-child' && panelItem.topLevelIndex === 0
                      const isLastTopLevelRow =
                        panelItem.kind !== 'group-child' &&
                        panelItem.topLevelIndex === orderedItems.length - 1
                      return (
                        <div key={`${panelItem.kind}-${panelItem.itemId}-${panelItem.topLevelIndex}`}>
                          {showSeparator ? (
                            <div className="mb-1 flex items-center justify-between rounded border border-dashed border-border/80 bg-muted/20 px-2 py-1 text-xs">
                              <span className="text-muted-foreground">Separador</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2"
                                  onClick={() => removeSeparatorItem(panelItem.topLevelIndex)}
                                >
                                  ×
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2"
                                  onClick={() => moveSeparatorItem(panelItem.topLevelIndex, 'up')}
                                  disabled={panelItem.topLevelIndex <= 1}
                                >
                                  ↑
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2"
                                  onClick={() => moveSeparatorItem(panelItem.topLevelIndex, 'down')}
                                  disabled={panelItem.topLevelIndex >= orderedItems.length - 1}
                                >
                                  ↓
                                </Button>
                              </div>
                            </div>
                          ) : null}
                          <div
                            className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
                              panelItem.kind === 'group-child'
                                ? 'ml-4 border-l border-border/60 pl-3 text-muted-foreground'
                                : 'hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate">
                                {rowLabel}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({rowTypeLabel})
                                </span>
                              </span>
                            </div>
                            <div className="ml-2 flex items-center gap-2">
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {rowRightLabel}
                              </span>
                              {group ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2"
                                  onClick={() => cycleGroupDisplayMode(group.id)}
                                  title={`Modo ${groupModeLabel}: ${
                                    groupMode === 'group'
                                      ? 'somente grupo'
                                      : groupMode === 'children'
                                        ? 'somente filhos'
                                        : 'grupo + filhos'
                                  }`}
                                >
                                  {groupModeLabel}
                                </Button>
                              ) : null}
                              {group ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2"
                                  onClick={() => removeGroup(group.id)}
                                >
                                  ×
                                </Button>
                              ) : null}
                              {panelItem.kind !== 'group-child' ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2"
                                  onClick={() => moveOrderItem(panelItem.itemId, 'up')}
                                  disabled={isFirstTopLevelRow}
                                >
                                  ↑
                                </Button>
                              ) : null}
                              {panelItem.kind !== 'group-child' ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2"
                                  onClick={() => moveOrderItem(panelItem.itemId, 'down')}
                                  disabled={isLastTopLevelRow}
                                >
                                  ↓
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {isCreateGroupOpen ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                <div
                  className="fixed inset-0"
                  onClick={() => setIsCreateGroupOpen(false)}
                />
                <div className="relative w-full max-w-2xl rounded-lg border bg-background p-3 shadow-lg sm:p-4">
                  <div className="mb-3">
                    <h4 className="text-base font-semibold">Criar grupo</h4>
                    <p className="text-xs text-muted-foreground">
                      Selecione 2 ou mais colunas do mesmo tipo (receita ou gasto).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Input
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                      placeholder="Nome do grupo..."
                    />
                    <div className="max-h-[42dvh] space-y-1 overflow-y-auto rounded-md border p-2">
                      {selectedColumnsOrdered.map((columnId) => {
                        const column = columnsCatalogById.get(columnId)
                        if (!column) {
                          return null
                        }
                        const isAlreadyGrouped = groupedColumnOwnerById.has(columnId)
                        const isDisabledByType =
                          selectedNewGroupType !== null &&
                          !newGroupColumnIds.includes(columnId) &&
                          column.type !== selectedNewGroupType
                        const isDisabledByGrouping =
                          isAlreadyGrouped && !newGroupColumnIds.includes(columnId)
                        const isDisabled = isDisabledByType || isDisabledByGrouping
                        return (
                          <label
                            key={`group-col-${columnId}`}
                            className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                              isDisabled
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer hover:bg-muted/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={newGroupColumnIds.includes(columnId)}
                              disabled={isDisabled}
                              onChange={(event) =>
                                toggleNewGroupColumn(columnId, event.target.checked)
                              }
                            />
                            <span className="truncate">
                              {column.label}
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({column.type === 'income' ? 'receita' : 'gasto'})
                              </span>
                              {isAlreadyGrouped ? (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  [ja em grupo]
                                </span>
                              ) : null}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreateGroupOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={createGroup}
                      disabled={
                        newGroupName.trim().length === 0 ||
                        newGroupColumnIds.length < 2 ||
                        newGroupColumnIds.some((columnId) => groupedColumnOwnerById.has(columnId)) ||
                        new Set(
                          newGroupColumnIds
                            .map((columnId) => columnsCatalogById.get(columnId)?.type)
                            .filter((type): type is 'income' | 'expense' => Boolean(type)),
                        ).size !== 1
                      }
                    >
                      Criar grupo
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsColumnsConfigOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isSummaryOpen && weeklyCashflowQuery.data ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fixed inset-0" onClick={() => setIsSummaryOpen(false)} />
          <div className="relative w-full max-w-4xl rounded-lg border bg-background p-3 shadow-lg sm:p-4">
            <div className="mb-3">
              <h3 className="text-base font-semibold">Resumo anual</h3>
              <p className="text-xs text-muted-foreground">
                Indicadores consolidados do ano selecionado.
              </p>
            </div>

            <section className="grid grid-cols-3 gap-2">
              <MiniSummaryCard label="Total no ano" value={summary.total} tone="balance" />
              <MiniSummaryCard label="Recebido no ano" value={summary.received} tone="income" />
              <MiniSummaryCard label="Gastos no ano" value={summary.spent} tone="expense" />
              <MiniSummaryCard
                label="Melhor semana"
                value={summary.bestWeek?.total ?? 0}
                tone="income"
                helper={summary.bestWeek ? `Sem ${summary.bestWeek.week}` : '-'}
              />
              <MiniSummaryCard
                label="Pior semana"
                value={summary.worstWeek?.total ?? 0}
                tone="expense"
                helper={summary.worstWeek ? `Sem ${summary.worstWeek.week}` : '-'}
              />
              <MiniSummaryCard
                label="Média até o momento"
                value={summary.averageUntilNow}
                tone="balance"
                helper={
                  summary.weeksUntilNowCount > 0
                    ? `${summary.weeksUntilNowCount} semana(s)`
                    : '-'
                }
              />
            </section>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSummaryOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {accountsQuery.isLoading ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Carregando contas...
        </div>
      ) : null}

      {accountsQuery.isError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">
          {getApiErrorMessage(accountsQuery.error)}
        </div>
      ) : null}

      {hasNoAccounts ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Nenhuma conta disponível para exibir o fluxo semanal.
        </div>
      ) : null}

      {weeklyCashflowQuery.isError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">
          {getApiErrorMessage(weeklyCashflowQuery.error)}
        </div>
      ) : null}

      {weeklyCashflowQuery.isLoading ? <WeeklyCashflowSkeleton /> : null}

      {!weeklyCashflowQuery.isLoading &&
      !weeklyCashflowQuery.isError &&
      weeklyCashflowQuery.data ? (
        <div className="space-y-3">
          {inconsistentWeeks.length > 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
              {`Foram encontradas ${inconsistentWeeks.length} semana(s) com divergência de total (total != recebido - gastos).`}
            </div>
          ) : null}

          {showEmptyColumnsHint ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
              Nenhuma coluna dinâmica selecionada. Use "Configurar colunas" para
              definir as colunas da sua visão.
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
	            <table className="min-w-[1100px] border-separate border-spacing-0 text-sm">
              <thead>
	                <tr className="border-b bg-muted/40 text-center">
                  <th className="sticky left-0 z-30 w-[56px] min-w-[56px] bg-muted px-2 py-2 text-center">
                    Semana
                  </th>
                  <th className="sticky left-[56px] z-30 w-[76px] min-w-[76px] bg-muted px-2 py-2 text-center">
                    Início
                  </th>
                  <th className="sticky left-[132px] z-30 w-[76px] min-w-[76px] border-r border-border/70 bg-muted px-2 py-2 text-center">
                    Fim
                  </th>
                  <th className="border-l w-[100px] min-w-[100px] px-2 py-2 text-center">
                    Total
                  </th>
                  <th className="w-[100px] min-w-[100px] px-2 py-2 text-center">
                    Recebido
                  </th>
                  <th className="w-[100px] min-w-[100px] px-2 py-2 text-center">
                    Gastos
                  </th>
	                  {visibleTableItems.map(({ itemId, topLevelIndex, label }, index) => {
                      const shouldShowSeparator =
                        index === 0 || separatorPositions.includes(topLevelIndex)
	                    return (
	                      <th
	                        key={itemId}
	                        className={`w-[120px] min-w-[120px] px-2 py-2 text-center ${shouldShowSeparator ? 'border-l-2 border-border/80' : ''}`}
	                      >
	                        {label}
	                      </th>
	                    )
	                  })}
	                </tr>
	              </thead>
	              <tbody>
	                {weeks.map((week) => {
                    const isCurrentWeek = isIsoDateInRange(todayIso, week.startDate, week.endDate)
                    const stickyCellClass = isCurrentWeek
                      ? 'bg-muted shadow-[inset_0_1px_0_hsl(var(--primary)/0.45),inset_0_-1px_0_hsl(var(--primary)/0.45)]'
                      : 'bg-background'
                    return (
		                  <tr
                      key={week.week}
                      className={`border-b ${isCurrentWeek ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/20'}`}
                    >
		                    <td className={`sticky left-0 z-10 w-[56px] min-w-[56px] border-r border-border/60 px-2 py-2 text-center font-medium ${stickyCellClass}`}>
		                      {week.week}
		                    </td>
	                    <td className={`sticky left-[56px] z-10 w-[76px] min-w-[76px] border-r border-border/60 px-2 py-2 text-center ${stickyCellClass}`}>
	                      {formatShortDate(week.startDate)}
	                    </td>
	                    <td className={`sticky left-[132px] z-10 w-[76px] min-w-[76px] border-r border-border/70 px-2 py-2 text-center ${stickyCellClass}`}>
	                      {formatShortDate(week.endDate)}
	                    </td>
                    <td className="border-l w-[100px] min-w-[100px] px-2 py-2 text-center font-medium">
                      {formatWeeklyValue(week.total)}
                    </td>
                    <td className="w-[100px] min-w-[100px] px-2 py-2 text-center text-emerald-600">
                      {formatWeeklyValue(week.received)}
                    </td>
                    <td className="w-[100px] min-w-[100px] px-2 py-2 text-center text-rose-600">
                      {formatWeeklyValue(week.spent)}
                    </td>
	                    {visibleTableItems.map(({ itemId, topLevelIndex, kind }, index) => {
                        const shouldShowSeparator =
                          index === 0 || separatorPositions.includes(topLevelIndex)
                        if (kind === 'group') {
                          const group = groupsByItemId.get(itemId)
                          if (!group) {
                            return null
                          }
                          const groupTotal = group.columnIds.reduce(
                            (sum, columnId) => sum + (week.dynamicValues[columnId] ?? 0),
                            0,
                          )
                          return (
                            <td
                              key={`${week.week}-${itemId}`}
                              className={`w-[120px] min-w-[120px] px-2 py-2 text-center ${shouldShowSeparator ? 'border-l-2 border-border/80' : ''}`}
                            >
                              {formatWeeklyValue(groupTotal)}
                            </td>
                          )
                        }
	                      return (
	                        <td
	                          key={`${week.week}-${itemId}`}
	                          className={`w-[120px] min-w-[120px] px-2 py-2 text-center ${shouldShowSeparator ? 'border-l-2 border-border/80' : ''}`}
	                        >
	                          {formatWeeklyValue(week.dynamicValues[itemId] ?? 0)}
	                        </td>
	                      )
	                    })}
	                  </tr>
                    )
                  })}
	              </tbody>
	            </table>
	          </div>
        </div>
      ) : null}
    </div>
  )
}

function WeeklyCashflowSkeleton() {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[1100px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              {Array.from({ length: 9 }).map((_, index) => (
                <th key={`weekly-skeleton-head-${index}`} className="px-3 py-2">
                  <div className="h-4 w-16 animate-pulse rounded bg-muted/60" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <tr key={`weekly-skeleton-row-${rowIndex}`} className="border-b">
                {Array.from({ length: 9 }).map((__, colIndex) => (
                  <td key={`weekly-skeleton-cell-${rowIndex}-${colIndex}`} className="px-3 py-2">
                    <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MiniSummaryCard({
  label,
  value,
  tone,
  helper,
}: {
  label: string
  value: number
  tone: 'income' | 'expense' | 'balance'
  helper?: string
}) {
  const valueClass =
    tone === 'income'
      ? 'text-emerald-600'
      : tone === 'expense'
        ? 'text-rose-600'
        : value > 0
          ? 'text-emerald-600'
          : value < 0
            ? 'text-rose-600'
            : 'text-foreground'

  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold ${valueClass}`}>
        {formatWeeklyValue(value)}
      </p>
      {helper ? <p className="text-[11px] text-muted-foreground">{helper}</p> : null}
    </div>
  )
}

function loadWeeklyCashflowViewState(
  key: string,
): WeeklyCashflowViewState | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as WeeklyCashflowViewState
    if (parsed?.version !== VIEW_STATE_VERSION || parsed?.viewId !== VIEW_ID) {
      return null
    }
    if (!parsed.groupDisplayModes && Array.isArray((parsed as { expandedGroupIds?: unknown }).expandedGroupIds)) {
      const expanded = (parsed as { expandedGroupIds?: string[] }).expandedGroupIds ?? []
      parsed.groupDisplayModes = Object.fromEntries(
        expanded.map((groupId) => [groupId, 'both' as GroupDisplayMode]),
      )
    }
    return parsed
  } catch {
    return null
  }
}

function saveWeeklyCashflowViewState(key: string, state: WeeklyCashflowViewState) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // no-op
  }
}

function formatWeeklyValue(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return '-'
  }
  return `$ ${formatCurrencyValue(value)}`
}

function formatShortDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return value
  }
  return `${match[3]}-${match[2]}`
}

function getLocalIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isIsoDateInRange(targetIso: string, startIso: string, endIso: string) {
  return targetIso >= startIso && targetIso <= endIso
}

function normalizeSeparatorPositions(
  separatorPositions?: number[],
  legacySeparatorPosition?: number | null,
) {
  if (Array.isArray(separatorPositions)) {
    return Array.from(new Set(separatorPositions)).sort((a, b) => a - b)
  }
  if (typeof legacySeparatorPosition === 'number') {
    return [legacySeparatorPosition]
  }
  return []
}

function areArraysEqual<T>(a: T[], b: T[]) {
  if (a.length !== b.length) {
    return false
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false
    }
  }
  return true
}

function areGroupsEqual(a: WeeklyCashflowGroup[], b: WeeklyCashflowGroup[]) {
  if (a.length !== b.length) {
    return false
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index]
    const right = b[index]
    if (!left || !right) {
      return false
    }
    if (left.id !== right.id || left.name !== right.name) {
      return false
    }
    if (!areArraysEqual(left.columnIds, right.columnIds)) {
      return false
    }
  }
  return true
}

function areGroupDisplayModesEqual(
  a: Record<string, GroupDisplayMode>,
  b: Record<string, GroupDisplayMode>,
) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false
    }
  }
  return true
}

function isGroupDisplayMode(value: unknown): value is GroupDisplayMode {
  return value === 'group' || value === 'children' || value === 'both'
}
