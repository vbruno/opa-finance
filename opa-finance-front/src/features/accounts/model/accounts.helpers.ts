import type { Account } from '@/features/accounts/accounts.api'
import type {
  AccountsSortDirection,
  AccountsSortKey,
} from '@/features/accounts/model/accounts.types'

export function normalizeAccountsSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function isRecurrenceConflictMessage(
  message: string | null | undefined,
) {
  if (!message) {
    return false
  }
  return normalizeAccountsSearch(message).includes('recorrencia ativa')
}

export function filterAccounts(
  accounts: Account[],
  searchTerm: string,
  typeFilter: string,
) {
  const normalizedSearch = normalizeAccountsSearch(searchTerm)

  return accounts.filter((account) => {
    const matchesName = normalizedSearch
      ? normalizeAccountsSearch(account.name).includes(normalizedSearch)
      : true
    const matchesType = typeFilter ? account.type === typeFilter : true
    return matchesName && matchesType
  })
}

export function sortAccounts(
  accounts: Account[],
  sortKey: AccountsSortKey,
  sortDirection: AccountsSortDirection,
  accountTypeLabels: Record<string, string>,
) {
  return [...accounts].sort((a, b) => {
    if (!sortKey) {
      return 0
    }

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1

    if (sortKey === 'balance') {
      const balanceA = a.currentBalance ?? 0
      const balanceB = b.currentBalance ?? 0
      return (balanceA - balanceB) * directionMultiplier
    }

    if (sortKey === 'type') {
      const labelA = accountTypeLabels[a.type] ?? a.type
      const labelB = accountTypeLabels[b.type] ?? b.type
      return labelA.localeCompare(labelB) * directionMultiplier
    }

    return a.name.localeCompare(b.name) * directionMultiplier
  })
}

export function paginateAccounts(
  accounts: Account[],
  currentPage: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(accounts.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedAccounts =
    accounts.length > pageSize
      ? accounts.slice((safePage - 1) * pageSize, safePage * pageSize)
      : accounts

  return {
    totalPages,
    safePage,
    paginatedAccounts,
  }
}

export function getBalanceToneClass(value: number) {
  if (value < 0) {
    return 'text-rose-600'
  }
  if (value > 0) {
    return 'text-emerald-600'
  }
  return 'text-muted-foreground'
}

export function resolveAccountsDisplayedTotal(params: {
  selectedCount: number
  selectedTotal: number
  totalFilteredBalance: number
}) {
  const { selectedCount, selectedTotal, totalFilteredBalance } = params
  return selectedCount >= 1 ? selectedTotal : totalFilteredBalance
}
