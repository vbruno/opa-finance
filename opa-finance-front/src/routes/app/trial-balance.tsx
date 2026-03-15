import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAccounts } from '@/features/accounts'
import {
  useTrialBalance,
  useTrialBalanceYears,
  type TrialBalanceLine,
} from '@/features/reports'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'

const monthLabels = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export const Route = createFileRoute('/app/trial-balance')({
  validateSearch: z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    accountIds: z.string().optional(),
  }),
  component: TrialBalancePage,
})

function TrialBalancePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const isDesktop = useMediaQuery('(min-width: 960px)')
  const currentYear = new Date().getFullYear()
  const year = search.year ?? currentYear

  const accountsQuery = useAccounts()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const allAccountIds = useMemo(() => accounts.map((account) => account.id), [accounts])
  const primaryAccountId = useMemo(() => {
    const primary = accounts.find((account) => account.isPrimary)
    return primary?.id ?? accounts[0]?.id ?? null
  }, [accounts])

  const selectedAccountIds = useMemo(() => {
    if (!search.accountIds) {
      return null
    }
    const ids = search.accountIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    return ids.length ? ids : null
  }, [search.accountIds])

  const sanitizedAccountIds = useMemo(() => {
    if (!selectedAccountIds) {
      return null
    }
    if (!allAccountIds.length) {
      return selectedAccountIds
    }
    const validIds = new Set(allAccountIds)
    const filtered = selectedAccountIds.filter((id) => validIds.has(id))
    if (!filtered.length) {
      return null
    }
    return allAccountIds.filter((id) => filtered.includes(id))
  }, [allAccountIds, selectedAccountIds])
  const effectiveAccountIds = useMemo(() => {
    if (sanitizedAccountIds?.length) {
      return sanitizedAccountIds
    }
    if (primaryAccountId) {
      return [primaryAccountId]
    }
    return []
  }, [primaryAccountId, sanitizedAccountIds])

  const yearsQuery = useTrialBalanceYears(
    {
      accountIds: effectiveAccountIds.length ? effectiveAccountIds : undefined,
    },
    {
      enabled: isDesktop && effectiveAccountIds.length > 0,
    },
  )
  const yearOptions = useMemo(() => yearsQuery.data?.years ?? [], [yearsQuery.data?.years])
  const hasSelectedYear = yearOptions.includes(year)
  const activeYear =
    hasSelectedYear || yearOptions.length === 0 ? year : yearOptions[0]

  const trialBalanceQuery = useTrialBalance(
    {
      year: activeYear,
      accountIds: effectiveAccountIds.length ? effectiveAccountIds : undefined,
    },
    {
      enabled:
        isDesktop &&
        effectiveAccountIds.length > 0 &&
        !yearsQuery.isLoading &&
        yearOptions.length > 0 &&
        hasSelectedYear,
    },
  )

  const setSearch = useCallback(
    (
      next: Partial<{
        year: number
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
    if (nextIds.length === 0) {
      setSearch({ accountIds: primaryAccountId ?? undefined })
      return
    }
    setSearch({ accountIds: nextIds.join(',') })
  }

  function toggleAccount(accountId: string) {
    const selectedSet = new Set(effectiveAccountIds)
    if (selectedSet.has(accountId)) {
      selectedSet.delete(accountId)
    } else {
      selectedSet.add(accountId)
    }
    const nextIds = allAccountIds.filter((id) => selectedSet.has(id))
    updateSelectedAccounts(nextIds)
  }
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false)
  const accountDropdownRef = useRef<HTMLDivElement | null>(null)

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

  if (!isDesktop) {
    return (
      <div className="rounded-md border p-4">
        <h1 className="text-lg font-semibold">Balancete</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A visualização de balancete está disponível na versão desktop.
        </p>
      </div>
    )
  }

  const selectedIdsForUi = effectiveAccountIds
  const selectedSet = new Set(selectedIdsForUi)
  const selectedCount = selectedIdsForUi.length
  const isAllAccountsSelected =
    allAccountIds.length > 0 && selectedCount === allAccountIds.length
  const isPrimaryOnlySelected =
    Boolean(primaryAccountId) &&
    selectedCount === 1 &&
    selectedIdsForUi[0] === primaryAccountId
  const selectedSingleAccountName =
    selectedCount === 1
      ? accounts.find((account) => account.id === selectedIdsForUi[0])?.name ??
        null
      : null
  const accountFilterLabel = isAllAccountsSelected
    ? 'Todas as contas'
    : isPrimaryOnlySelected
      ? 'Conta principal'
      : selectedSingleAccountName ?? `${selectedCount} contas`
  const showBalanceSkeleton = yearsQuery.isLoading || trialBalanceQuery.isLoading
  const isEmpty =
    (!yearsQuery.isLoading &&
      !yearsQuery.isError &&
      yearOptions.length === 0) ||
    (!trialBalanceQuery.isLoading &&
      !trialBalanceQuery.isError &&
      yearOptions.length > 0 &&
      ((trialBalanceQuery.data?.income.length ?? 0) === 0 &&
        (trialBalanceQuery.data?.expense.length ?? 0) === 0))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md border p-2">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Balancete</h1>
          </div>
        </div>

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
          <div ref={accountDropdownRef} className="relative">
            <button
              type="button"
              className="flex h-8 min-w-[220px] items-center justify-between rounded-md border px-3 text-sm"
              onClick={() =>
                setIsAccountDropdownOpen((currentOpen) => !currentOpen)
              }
              aria-expanded={isAccountDropdownOpen}
            >
              <span className="truncate">{accountFilterLabel}</span>
              <ChevronDown
                className={`ml-2 size-4 text-muted-foreground ${isAccountDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isAccountDropdownOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border bg-background p-2 shadow-lg">
                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={isPrimaryOnlySelected}
                      onChange={() =>
                        setSearch({ accountIds: primaryAccountId ?? undefined })
                      }
                      disabled={!primaryAccountId}
                    />
                    <span>Somente conta principal</span>
                  </label>

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
                </div>

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
                        checked={selectedSet.has(account.id)}
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
      </div>

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

      {showBalanceSkeleton ? (
        <TrialBalanceSkeleton />
      ) : null}

      {trialBalanceQuery.isError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">
          {getApiErrorMessage(trialBalanceQuery.error)}
        </div>
      ) : null}

      {isEmpty ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Não há dados para o ano selecionado.
        </div>
      ) : null}

      {!showBalanceSkeleton && !trialBalanceQuery.isError && trialBalanceQuery.data ? (
        <div className="space-y-4">
          <section className="grid grid-cols-3 gap-2">
            <SummaryCard
              label="Receitas (ano)"
              value={trialBalanceQuery.data.totals.income.yearTotal}
              tone="income"
            />
            <SummaryCard
              label="Despesas (ano)"
              value={trialBalanceQuery.data.totals.expense.yearTotal}
              tone="expense"
            />
            <SummaryCard
              label="Resultado (ano)"
              value={
                trialBalanceQuery.data.totals.income.yearTotal -
                trialBalanceQuery.data.totals.expense.yearTotal
              }
              tone="balance"
            />
          </section>

          <BalanceSectionTable
            sectionLabel="Receitas"
            sectionTone="income"
            data={trialBalanceQuery.data.income}
            totals={trialBalanceQuery.data.totals.income}
          />

          <BalanceSectionTable
            sectionLabel="Despesas"
            sectionTone="expense"
            data={trialBalanceQuery.data.expense}
            totals={trialBalanceQuery.data.totals.expense}
          />
        </div>
      ) : null}
    </div>
  )
}

function TrialBalanceSkeleton() {
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`trial-balance-summary-skeleton-${index}`}
            className="animate-pulse rounded-md border px-4 py-3.5"
          >
            <div className="h-4 w-28 rounded bg-muted/60" />
            <div className="mt-2 h-6 w-32 rounded bg-muted/60" />
          </div>
        ))}
      </section>

      <BalanceSectionSkeleton sectionTone="income" />
      <BalanceSectionSkeleton sectionTone="expense" />
    </div>
  )
}

function BalanceSectionSkeleton({ sectionTone }: { sectionTone: 'income' | 'expense' }) {
  const sectionClass =
    sectionTone === 'income'
      ? 'border-emerald-500/25 bg-emerald-500/10'
      : 'border-red-500/25 bg-red-500/10'

  return (
    <section className="rounded-lg border">
      <div className={`border-b px-3 py-2 ${sectionClass}`}>
        <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left">
                <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
              </th>
              {monthLabels.map((label) => (
                <th key={`skeleton-${sectionTone}-${label}`} className="px-2 py-2">
                  <div className="ml-auto h-4 w-8 animate-pulse rounded bg-muted/60" />
                </th>
              ))}
              <th className="px-3 py-2">
                <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted/60" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <tr key={`skeleton-row-${sectionTone}-${rowIndex}`} className="border-b">
                <td className="px-3 py-2">
                  <div className="h-4 w-44 animate-pulse rounded bg-muted/60" />
                </td>
                {Array.from({ length: 12 }).map((__, colIndex) => (
                  <td
                    key={`skeleton-cell-${sectionTone}-${rowIndex}-${colIndex}`}
                    className="px-2 py-2"
                  >
                    <div className="ml-auto h-4 w-12 animate-pulse rounded bg-muted/60" />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="ml-auto h-4 w-14 animate-pulse rounded bg-muted/60" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'income' | 'expense' | 'balance'
}) {
  const isBalancePositive = tone === 'balance' && value > 0
  const isBalanceNegative = tone === 'balance' && value < 0

  const labelToneClass =
    tone === 'income' || isBalancePositive
      ? 'text-emerald-500'
      : tone === 'expense' || isBalanceNegative
        ? 'text-rose-500'
        : 'text-muted-foreground'
  const valueToneClass =
    tone === 'income' || isBalancePositive
      ? 'text-emerald-600'
      : tone === 'expense' || isBalanceNegative
        ? 'text-rose-600'
        : 'text-foreground'

  const ToneIcon =
    tone === 'income' ? ArrowUpRight : tone === 'expense' ? ArrowDownRight : Wallet

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3.5">
      <p className="flex items-center gap-2 text-sm leading-5 text-muted-foreground">
        <ToneIcon className={`size-4 ${labelToneClass}`} />
        {label}
      </p>
      <p className={`text-lg font-semibold leading-6 ${valueToneClass}`}>
        {formatBalanceCell(value)}
      </p>
    </div>
  )
}

function BalanceSectionTable({
  sectionLabel,
  sectionTone,
  data,
  totals,
}: {
  sectionLabel: string
  sectionTone: 'income' | 'expense'
  data: TrialBalanceLine[]
  totals: { months: number[]; yearTotal: number }
}) {
  const sectionClass =
    sectionTone === 'income'
      ? 'border-emerald-500/25 bg-emerald-500/10'
      : 'border-red-500/25 bg-red-500/10'
  const allCategoryIds = useMemo(() => data.map((category) => category.categoryId), [data])
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(
    () => new Set(allCategoryIds),
  )
  const areAllCollapsed =
    allCategoryIds.length > 0 &&
    allCategoryIds.every((categoryId) => collapsedCategoryIds.has(categoryId))

  useEffect(() => {
    setCollapsedCategoryIds(new Set(allCategoryIds))
  }, [allCategoryIds])

  function toggleCategory(categoryId: string) {
    setCollapsedCategoryIds((previous) => {
      const next = new Set(previous)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  function expandAll() {
    setCollapsedCategoryIds(new Set())
  }

  function collapseAll() {
    setCollapsedCategoryIds(new Set(allCategoryIds))
  }

  return (
    <section className="rounded-lg border">
      <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${sectionClass}`}>
        <h2 className="text-sm font-semibold">{sectionLabel}</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={areAllCollapsed ? expandAll : collapseAll}
          >
            {areAllCollapsed ? 'Expandir tudo' : 'Recolher tudo'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="sticky left-0 z-10 min-w-[260px] bg-muted/40 px-3 py-2 font-medium">
                Categoria / Subcategoria
              </th>
              {monthLabels.map((label) => (
                <th key={`${sectionLabel}-${label}`} className="px-2 py-2 text-right font-medium">
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total/Ano</th>
            </tr>
          </thead>

          <tbody>
            {data.map((category) => (
              <CategoryRows
                key={`${sectionLabel}-${category.categoryId}`}
                category={category}
                isCollapsed={collapsedCategoryIds.has(category.categoryId)}
                onToggle={() => toggleCategory(category.categoryId)}
              />
            ))}

            <tr className="border-t-2 bg-muted/30">
              <td className="sticky left-0 bg-muted/30 px-3 py-2 font-bold">
                {`Total geral ${sectionLabel.toLowerCase()}`}
              </td>
              {totals.months.map((value, index) => (
                <td
                  key={`${sectionLabel}-total-${index}`}
                  className="px-2 py-2 text-right font-bold"
                >
                  {formatBalanceCell(value)}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-bold">
                {formatBalanceCell(totals.yearTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CategoryRows({
  category,
  isCollapsed,
  onToggle,
}: {
  category: TrialBalanceLine
  isCollapsed: boolean
  onToggle: () => void
}) {
  const hasSubcategories = category.subcategories.length > 0

  return (
    <>
      <tr className="border-b bg-muted/10">
        <td className="sticky left-0 bg-muted/10 px-3 py-2 font-medium">
          <div className="flex items-center gap-2">
            {hasSubcategories ? (
              <button
                type="button"
                className="rounded p-0.5 hover:bg-background/80"
                onClick={onToggle}
                aria-label={
                  isCollapsed
                    ? `Expandir categoria ${category.categoryName}`
                    : `Recolher categoria ${category.categoryName}`
                }
                title={
                  isCollapsed
                    ? `Expandir ${category.categoryName}`
                    : `Recolher ${category.categoryName}`
                }
              >
                {isCollapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
            ) : (
              <span className="inline-block size-5" />
            )}
            <span>{category.categoryName}</span>
          </div>
        </td>
        {category.months.map((value, index) => (
          <td
            key={`${category.categoryId}-month-${index}`}
            className="px-2 py-2 text-right font-medium"
          >
            {formatBalanceCell(value)}
          </td>
        ))}
        <td className="px-3 py-2 text-right font-semibold">
          {formatBalanceCell(category.yearTotal)}
        </td>
      </tr>

      {!isCollapsed &&
        category.subcategories.map((subcategory) => (
        <tr key={subcategory.subcategoryId} className="border-b">
          <td className="sticky left-0 bg-background px-3 py-2 text-muted-foreground">
            <span className="inline-block pl-4">{subcategory.subcategoryName}</span>
          </td>
          {subcategory.months.map((value, index) => (
            <td
              key={`${subcategory.subcategoryId}-month-${index}`}
              className="px-2 py-2 text-right text-muted-foreground"
            >
              {formatBalanceCell(value)}
            </td>
          ))}
          <td className="px-3 py-2 text-right text-muted-foreground">
            {formatBalanceCell(subcategory.yearTotal)}
          </td>
        </tr>
        ))}
    </>
  )
}

function formatBalanceCell(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return '-'
  }
  return `$ ${formatCurrencyValue(value)}`
}
