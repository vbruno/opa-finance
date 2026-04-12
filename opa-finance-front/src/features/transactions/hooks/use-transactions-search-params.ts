import { useCallback, useEffect, useRef, useState } from 'react'

import { parseAmountFilter } from '../model/transactions.helpers'
import type { TransactionsQueryParams } from '../transactions.api'

type SortKey = NonNullable<TransactionsQueryParams['sort']>
type SortDirection = NonNullable<TransactionsQueryParams['dir']>

export type TransactionsSearchParams = {
  page?: number
  limit?: number
  type?: TransactionsQueryParams['type']
  accountId?: string
  categoryId?: string
  subcategoryId?: string
  description?: string
  includeNotes?: boolean
  notesOnly?: boolean
  amountMode?: boolean
  amount?: string
  sort?: SortKey
  dir?: SortDirection
  startDate?: string
  endDate?: string
}

type NavigateSearch = {
  search: (
    previous: TransactionsSearchParams,
  ) => TransactionsSearchParams
  replace?: boolean
}

export type TransactionsNavigateFn = (options: NavigateSearch) => void

type UseTransactionsSearchParamsInput = {
  search: TransactionsSearchParams
  navigate: TransactionsNavigateFn
  limitPreference: number
}

export function useTransactionsSearchParams({
  search,
  navigate,
  limitPreference,
}: UseTransactionsSearchParamsInput) {
  const isClearingDescription = useRef(false)
  const isClearingAmount = useRef(false)

  const page = search.page ?? 1
  const limit = search.limit ?? limitPreference
  const typeFilter = search.type ?? ''
  const accountFilter = search.accountId ?? ''
  const categoryFilter = search.categoryId ?? ''
  const subcategoryFilter = search.subcategoryId ?? ''
  const descriptionFilter = search.description ?? ''
  const includeNotes = search.includeNotes ?? false
  const notesOnly = search.notesOnly ?? false
  const amountMode = search.amountMode ?? false
  const amountFilter = search.amount ?? ''
  const sortKey = search.sort ?? null
  const sortDirection: SortDirection = search.dir ?? 'desc'
  const startDateFilter = search.startDate ?? ''
  const endDateFilter = search.endDate ?? ''

  const hasActiveFilters =
    typeFilter ||
    accountFilter ||
    categoryFilter ||
    subcategoryFilter ||
    descriptionFilter ||
    includeNotes ||
    notesOnly ||
    amountMode ||
    amountFilter ||
    startDateFilter ||
    endDateFilter

  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(descriptionFilter)
  const [amountDraft, setAmountDraft] = useState(amountFilter)

  const debouncedDescription = useDebouncedValue(descriptionDraft, 500)
  const debouncedAmount = useDebouncedValue(amountDraft, 500)
  const effectiveDescriptionFilter = debouncedDescription.trim()
  const effectiveAmountFilter = debouncedAmount.trim()
  const canSearchNotes = !amountMode && descriptionDraft.trim().length > 0

  const parsedAmountFilter = amountMode
    ? parseAmountFilter(effectiveAmountFilter)
    : null
  const isAmountFilterInvalid =
    amountMode &&
    amountDraft.trim().length > 0 &&
    !parseAmountFilter(amountDraft.trim())
  const amountFilterErrorMessage = isAmountFilterInvalid
    ? 'Filtro por valor aceita apenas números ou expressões válidas.'
    : ''

  const queryParams: TransactionsQueryParams = {
    page,
    limit,
    type: typeFilter || undefined,
    accountId: accountFilter || undefined,
    categoryId: categoryFilter || undefined,
    subcategoryId: subcategoryFilter || undefined,
    description: amountMode
      ? undefined
      : notesOnly
        ? undefined
        : effectiveDescriptionFilter || undefined,
    notes:
      !amountMode && (includeNotes || notesOnly) && effectiveDescriptionFilter
        ? effectiveDescriptionFilter
        : undefined,
    amount: parsedAmountFilter?.amount,
    amountMin: parsedAmountFilter?.amountMin,
    amountMax: parsedAmountFilter?.amountMax,
    amountOp: parsedAmountFilter?.amountOp,
    sort: sortKey || undefined,
    dir: sortKey ? sortDirection : undefined,
    startDate: startDateFilter || undefined,
    endDate: endDateFilter || undefined,
  }

  useEffect(() => {
    setDescriptionDraft(descriptionFilter)
  }, [descriptionFilter])

  useEffect(() => {
    setAmountDraft(amountFilter)
  }, [amountFilter])

  useEffect(() => {
    if (amountMode) {
      return
    }
    const trimmedValue = descriptionDraft.trim()
    if (trimmedValue === descriptionFilter) {
      return
    }
    if (isClearingDescription.current) {
      isClearingDescription.current = false
      return
    }
    navigate({
      search: (prev) => ({
        ...prev,
        description: trimmedValue ? trimmedValue : undefined,
        includeNotes: trimmedValue ? prev.includeNotes : undefined,
        page: 1,
      }),
      replace: true,
    })
  }, [amountMode, descriptionDraft, descriptionFilter, navigate])

  useEffect(() => {
    if (!amountMode) {
      return
    }
    const trimmedValue = amountDraft.trim()
    if (trimmedValue === amountFilter) {
      return
    }
    if (isClearingAmount.current) {
      isClearingAmount.current = false
      return
    }
    navigate({
      search: (prev) => ({
        ...prev,
        amount: trimmedValue ? trimmedValue : undefined,
        page: 1,
      }),
      replace: true,
    })
  }, [amountDraft, amountFilter, amountMode, navigate])

  const handleClearFilters = useCallback(() => {
    isClearingDescription.current = true
    isClearingAmount.current = true
    setDescriptionDraft('')
    setAmountDraft('')
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        type: undefined,
        accountId: undefined,
        categoryId: undefined,
        subcategoryId: undefined,
        description: undefined,
        includeNotes: undefined,
        notesOnly: undefined,
        amountMode: undefined,
        amount: undefined,
        startDate: undefined,
        endDate: undefined,
      }),
    })
  }, [navigate])

  const handleSort = useCallback(
    (nextKey: SortKey) => {
      navigate({
        search: (prev) => {
          const isSame = prev.sort === nextKey
          const nextDirection = isSame && prev.dir === 'asc' ? 'desc' : 'asc'
          return {
            ...prev,
            sort: nextKey,
            dir: nextDirection,
          }
        },
        replace: false,
      })
    },
    [navigate],
  )

  const setIncludeNotesFilter = useCallback(
    (checked: boolean) => {
      navigate({
        search: (prev) => ({
          ...prev,
          includeNotes: checked ? true : undefined,
          notesOnly: checked ? prev.notesOnly : undefined,
          page: 1,
        }),
      })
    },
    [navigate],
  )

  const setNotesOnlyFilter = useCallback(
    (checked: boolean) => {
      navigate({
        search: (prev) => ({
          ...prev,
          notesOnly: checked ? true : undefined,
          includeNotes: checked ? true : prev.includeNotes,
          page: 1,
        }),
      })
    },
    [navigate],
  )

  const setAmountModeFilter = useCallback(
    (checked: boolean) => {
      navigate({
        search: (prev) => ({
          ...prev,
          amountMode: checked ? true : undefined,
          amount: checked ? prev.amount : undefined,
          description: checked ? undefined : prev.description,
          includeNotes: checked ? undefined : prev.includeNotes,
          notesOnly: checked ? undefined : prev.notesOnly,
          page: 1,
        }),
      })
    },
    [navigate],
  )

  const setStartDateFilter = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          startDate: value || undefined,
          page: 1,
        }),
      })
    },
    [navigate],
  )

  const setEndDateFilter = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          endDate: value || undefined,
          page: 1,
        }),
      })
    },
    [navigate],
  )

  const setTypeFilterValue = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          type: value === 'all' ? undefined : (value as TransactionsQueryParams['type']),
          page: 1,
        }),
      })
    },
    [navigate],
  )

  const setAccountFilterValue = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          accountId: value === 'all' ? undefined : value,
          page: 1,
        }),
      })
    },
    [navigate],
  )

  const setCategoryFilterValue = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          categoryId: value === 'all' ? undefined : value,
          subcategoryId: undefined,
          page: 1,
        }),
      })
    },
    [navigate],
  )

  const setSubcategoryFilterValue = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          subcategoryId: value === 'all' ? undefined : value,
          page: 1,
        }),
      })
    },
    [navigate],
  )

  return {
    page,
    limit,
    typeFilter,
    accountFilter,
    categoryFilter,
    subcategoryFilter,
    descriptionFilter,
    includeNotes,
    notesOnly,
    amountMode,
    amountFilter,
    sortKey,
    sortDirection,
    startDateFilter,
    endDateFilter,
    hasActiveFilters,
    isFilterExpanded,
    setIsFilterExpanded,
    descriptionDraft,
    setDescriptionDraft,
    amountDraft,
    setAmountDraft,
    canSearchNotes,
    isAmountFilterInvalid,
    amountFilterErrorMessage,
    queryParams,
    isQueryEnabled: !isAmountFilterInvalid,
    handleClearFilters,
    handleSort,
    setIncludeNotesFilter,
    setNotesOnlyFilter,
    setAmountModeFilter,
    setStartDateFilter,
    setEndDateFilter,
    setTypeFilterValue,
    setAccountFilterValue,
    setCategoryFilterValue,
    setSubcategoryFilterValue,
  }
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)
    return () => window.clearTimeout(timeoutId)
  }, [value, delayMs])

  return debouncedValue
}
