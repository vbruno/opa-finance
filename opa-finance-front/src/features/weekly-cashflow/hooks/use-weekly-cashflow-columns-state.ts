import { startTransition, useState } from 'react'

import { GROUP_ITEM_PREFIX } from '@/features/weekly-cashflow/model/weekly-cashflow.constants'
import type {
  GroupDisplayMode,
  SortDirection,
  WeeklyCashflowGroup,
  WeeklySortKey,
} from '@/features/weekly-cashflow/model/weekly-cashflow.types'

type Params = {
  initialSelectedColumnIds: string[]
  initialColumnOrder: string[]
  initialGroups: WeeklyCashflowGroup[]
  initialGroupDisplayModes: Record<string, GroupDisplayMode>
  initialSeparatorPositions: number[]
  initialSortDynamicByShare: boolean
}

export function useWeeklyCashflowColumnsState({
  initialSelectedColumnIds,
  initialColumnOrder,
  initialGroups,
  initialGroupDisplayModes,
  initialSeparatorPositions,
  initialSortDynamicByShare,
}: Params) {
  const [isColumnsConfigOpen, setIsColumnsConfigOpen] = useState(false)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [columnSearch, setColumnSearch] = useState('')
  const [columnTypeFilter, setColumnTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(initialSelectedColumnIds)
  const [columnOrder, setColumnOrder] = useState<string[]>(initialColumnOrder)
  const [groups, setGroups] = useState<WeeklyCashflowGroup[]>(initialGroups)
  const [groupDisplayModes, setGroupDisplayModes] = useState<Record<string, GroupDisplayMode>>(
    initialGroupDisplayModes,
  )
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColumnIds, setNewGroupColumnIds] = useState<string[]>([])
  const [separatorPositions, setSeparatorPositions] = useState<number[]>(initialSeparatorPositions)
  const [sortKey, setSortKey] = useState<WeeklySortKey>('week')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [sortDynamicByShare, setSortDynamicByShare] = useState(initialSortDynamicByShare)
  const [isProjectionEnabled, setIsProjectionEnabled] = useState(false)

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

  function moveOrderItem(
    itemId: string,
    direction: 'up' | 'down',
    validItemIds: string[],
  ) {
    setColumnOrder((previous) => {
      const validIds = new Set<string>(validItemIds)
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

  function toggleSort(key: WeeklySortKey) {
    if (sortKey === key) {
      setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('desc')
  }

  function sortIndicator(key: WeeklySortKey) {
    if (sortKey !== key) {
      return ''
    }
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
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

  function openCreateGroupModal() {
    setEditingGroupId(null)
    setNewGroupName('')
    setNewGroupColumnIds([])
    setIsCreateGroupOpen(true)
  }

  function closeGroupModal() {
    setIsCreateGroupOpen(false)
    setEditingGroupId(null)
    setNewGroupName('')
    setNewGroupColumnIds([])
  }

  function openEditGroupModal(groupId: string, groupName: string, groupColumnIds: string[]) {
    setEditingGroupId(groupId)
    setNewGroupName(groupName)
    setNewGroupColumnIds(groupColumnIds)
    setIsCreateGroupOpen(true)
  }

  function createGroup(columnIds: string[], groupedColumnOwnerById: Map<string, string>) {
    const name = newGroupName.trim()
    const uniqueColumnIds = Array.from(new Set(columnIds))
    if (!name || uniqueColumnIds.length < 2) {
      return false
    }
    const editingGroupItemId = editingGroupId ? `${GROUP_ITEM_PREFIX}${editingGroupId}` : null
    const hasOverlappingColumns = uniqueColumnIds.some((columnId) => {
      const ownerGroupItemId = groupedColumnOwnerById.get(columnId)
      if (!ownerGroupItemId) {
        return false
      }
      if (editingGroupItemId && ownerGroupItemId === editingGroupItemId) {
        return false
      }
      return true
    })
    if (hasOverlappingColumns) {
      return false
    }
    if (editingGroupId) {
      setGroups((previous) =>
        previous.map((group) =>
          group.id === editingGroupId ? { ...group, name, columnIds: uniqueColumnIds } : group,
        ),
      )
    } else {
      const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setGroups((previous) => [...previous, { id, name, columnIds: uniqueColumnIds }])
      setColumnOrder((previous) => [...previous, `${GROUP_ITEM_PREFIX}${id}`])
    }
    closeGroupModal()
    return true
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
    if (editingGroupId === groupId) {
      closeGroupModal()
    }
  }

  function cycleGroupDisplayMode(groupId: string) {
    setGroupDisplayModes((previous) => {
      const current = previous[groupId] ?? 'group'
      const nextMode: GroupDisplayMode =
        current === 'group' ? 'children' : current === 'children' ? 'both' : 'group'
      return { ...previous, [groupId]: nextMode }
    })
  }

  function addSeparatorItem(orderedItemsLength: number) {
    if (orderedItemsLength < 2) {
      return
    }
    const maxPosition = orderedItemsLength - 1
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
    setSeparatorPositions((previous) => previous.filter((current) => current !== position))
  }

  function moveSeparatorItem(
    position: number,
    direction: 'up' | 'down',
    maxPosition: number,
  ) {
    setSeparatorPositions((previous) => {
      if (!previous.includes(position)) {
        return previous
      }
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

  return {
    isColumnsConfigOpen,
    setIsColumnsConfigOpen,
    isCreateGroupOpen,
    setIsCreateGroupOpen,
    editingGroupId,
    setEditingGroupId,
    isSummaryOpen,
    setIsSummaryOpen,
    columnSearch,
    setColumnSearch,
    columnTypeFilter,
    setColumnTypeFilter,
    selectedColumnIds,
    setSelectedColumnIds,
    columnOrder,
    setColumnOrder,
    groups,
    setGroups,
    groupDisplayModes,
    setGroupDisplayModes,
    newGroupName,
    setNewGroupName,
    newGroupColumnIds,
    setNewGroupColumnIds,
    separatorPositions,
    setSeparatorPositions,
    sortKey,
    sortDirection,
    sortDynamicByShare,
    setSortDynamicByShare,
    isProjectionEnabled,
    setIsProjectionEnabled,
    toggleDynamicColumn,
    moveOrderItem,
    toggleSort,
    sortIndicator,
    toggleNewGroupColumn,
    openCreateGroupModal,
    closeGroupModal,
    openEditGroupModal,
    createGroup,
    removeGroup,
    cycleGroupDisplayMode,
    addSeparatorItem,
    removeSeparatorItem,
    moveSeparatorItem,
  }
}
