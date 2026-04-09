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
  useConsolidated,
  useConsolidatedYears,
  useRecurrenceForecast,
  type ConsolidatedLine,
  type RecurrenceForecastResponse,
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

export const Route = createFileRoute('/app/consolidated')({
  validateSearch: z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    accountIds: z.string().optional(),
  }),
  component: ConsolidatedPage,
})

function ConsolidatedPage() {
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

  const yearsQuery = useConsolidatedYears(
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

  const consolidatedQuery = useConsolidated(
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
  const [isProjectionEnabled, setIsProjectionEnabled] = useState(false)
  const recurrenceForecastQuery = useRecurrenceForecast(
    {
      year: activeYear,
      accountIds: effectiveAccountIds.length ? effectiveAccountIds : undefined,
    },
    {
      enabled:
        isDesktop &&
        isProjectionEnabled &&
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
        <h1 className="text-lg font-semibold">Consolidado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A visualização de consolidado está disponível na versão desktop.
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
  const showBalanceSkeleton =
    yearsQuery.isLoading ||
    consolidatedQuery.isLoading ||
    (isProjectionEnabled && recurrenceForecastQuery.isLoading)
  const isEmpty =
    (!yearsQuery.isLoading &&
      !yearsQuery.isError &&
      yearOptions.length === 0) ||
    (!consolidatedQuery.isLoading &&
      !consolidatedQuery.isError &&
      yearOptions.length > 0 &&
      ((consolidatedQuery.data?.income.length ?? 0) === 0 &&
        (consolidatedQuery.data?.expense.length ?? 0) === 0))
  const projectionTotals = recurrenceForecastQuery.data?.totals
  const hasProjectionData =
    isProjectionEnabled &&
    !recurrenceForecastQuery.isError &&
    Boolean(projectionTotals)
  const incomeYearTotal = hasProjectionData
    ? projectionTotals?.combined.income.yearTotal ?? 0
    : consolidatedQuery.data?.totals.income.yearTotal ?? 0
  const expenseYearTotal = hasProjectionData
    ? projectionTotals?.combined.expense.yearTotal ?? 0
    : consolidatedQuery.data?.totals.expense.yearTotal ?? 0
  const balanceYearTotal = incomeYearTotal - expenseYearTotal

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md border p-2">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Consolidado</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={isProjectionEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsProjectionEnabled((current) => !current)}
            disabled={showBalanceSkeleton || yearOptions.length === 0}
          >
            {isProjectionEnabled ? 'Ocultar projeção' : 'Mostrar projeção'}
          </Button>
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
        <ConsolidatedSkeleton />
      ) : null}

      {consolidatedQuery.isError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">
          {getApiErrorMessage(consolidatedQuery.error)}
        </div>
      ) : null}

      {isProjectionEnabled && recurrenceForecastQuery.isError ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700">
          {`Não foi possível carregar projeção. Exibindo somente dados reais. (${getApiErrorMessage(
            recurrenceForecastQuery.error,
          )})`}
        </div>
      ) : null}

      {isEmpty ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Não há dados para o ano selecionado.
        </div>
      ) : null}

      {!showBalanceSkeleton && !consolidatedQuery.isError && consolidatedQuery.data ? (
        <div className="space-y-4">
          <section className="grid grid-cols-3 gap-2">
            <SummaryCard
              label="Receitas (ano)"
              value={incomeYearTotal}
              tone="income"
              helper={
                hasProjectionData
                  ? `Real ${formatBalanceCell(
                      projectionTotals?.real.income.yearTotal ?? 0,
                    )} · Proj ${formatBalanceCell(
                      projectionTotals?.projected.income.yearTotal ?? 0,
                    )}`
                  : undefined
              }
            />
            <SummaryCard
              label="Despesas (ano)"
              value={expenseYearTotal}
              tone="expense"
              helper={
                hasProjectionData
                  ? `Real ${formatBalanceCell(
                      projectionTotals?.real.expense.yearTotal ?? 0,
                    )} · Proj ${formatBalanceCell(
                      projectionTotals?.projected.expense.yearTotal ?? 0,
                    )}`
                  : undefined
              }
            />
            <SummaryCard
              label="Resultado (ano)"
              value={balanceYearTotal}
              tone="balance"
              helper={
                hasProjectionData
                  ? `Real ${formatBalanceCell(
                      projectionTotals?.real.balance.yearTotal ?? 0,
                    )} · Proj ${formatBalanceCell(
                      projectionTotals?.projected.balance.yearTotal ?? 0,
                    )}`
                  : undefined
              }
            />
          </section>

          {hasProjectionData && projectionTotals && recurrenceForecastQuery.data ? (
            <ForecastTotalsTable forecast={recurrenceForecastQuery.data} />
          ) : null}

          <BalanceSectionTable
            sectionLabel="Receitas"
            sectionTone="income"
            data={consolidatedQuery.data.income}
            totals={consolidatedQuery.data.totals.income}
          />

          <BalanceSectionTable
            sectionLabel="Despesas"
            sectionTone="expense"
            data={consolidatedQuery.data.expense}
            totals={consolidatedQuery.data.totals.expense}
          />

          <MonthlyBalanceTable
            incomeMonths={consolidatedQuery.data.totals.income.months}
            expenseMonths={consolidatedQuery.data.totals.expense.months}
            incomeYearTotal={consolidatedQuery.data.totals.income.yearTotal}
            expenseYearTotal={consolidatedQuery.data.totals.expense.yearTotal}
          />
        </div>
      ) : null}
    </div>
  )
}

function MonthlyBalanceTable({
  incomeMonths,
  expenseMonths,
  incomeYearTotal,
  expenseYearTotal,
}: {
  incomeMonths: number[]
  expenseMonths: number[]
  incomeYearTotal: number
  expenseYearTotal: number
}) {
  const monthlyBalance = useMemo(
    () => incomeMonths.map((income, index) => income - (expenseMonths[index] ?? 0)),
    [expenseMonths, incomeMonths],
  )
  const monthlyBalanceVariationPercents = useMemo(
    () =>
      monthlyBalance.map((currentValue, index) => {
        if (index === 0) {
          return null
        }
        const previousValue = monthlyBalance[index - 1]
        if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
          return null
        }
        return currentValue - previousValue
      }),
    [monthlyBalance],
  )
  const yearBalance = incomeYearTotal - expenseYearTotal

  return (
    <section className="rounded-lg border">
      <div className="border-b bg-muted/20 px-3 py-2">
        <h2 className="text-sm font-semibold">Saldo mensal (Receita - Despesa)</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="sticky left-0 z-10 min-w-[260px] bg-muted/40 px-3 py-2 font-medium">
                Indicador
              </th>
              {monthLabels.map((label) => (
                <th key={`monthly-balance-${label}`} className="px-2 py-2 text-center font-medium">
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total/Ano</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="sticky left-0 bg-background px-3 py-2 font-medium">
                Saldo do mês
              </td>
              {monthlyBalance.map((value, index) => (
                <td
                  key={`monthly-balance-value-${index}`}
                  className={`px-2 py-2 ${getBalanceCellAlignmentClass(value)} ${getMonthlyBalanceToneClass(value)}`}
                >
                  {formatBalanceCell(value)}
                </td>
              ))}
              <td
                className={`px-3 py-2 ${getBalanceCellAlignmentClass(yearBalance)} ${getMonthlyBalanceToneClass(yearBalance)}`}
              >
                {formatBalanceCell(yearBalance)}
              </td>
            </tr>

            <tr className="border-b bg-muted/10">
              <td className="sticky left-0 bg-muted/10 px-3 py-2 text-xs font-medium text-muted-foreground">
                Diferença vs mês anterior
              </td>
              {monthlyBalanceVariationPercents.map((value, index) => (
                <td
                  key={`monthly-balance-variation-${index}`}
                  className={`px-2 py-2 text-center text-xs font-medium ${getMonthlyBalanceVariationToneClass(value)}`}
                >
                  {formatBalanceDelta(value)}
                </td>
              ))}
              <td className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                -
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ConsolidatedSkeleton() {
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`consolidated-summary-skeleton-${index}`}
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
  helper,
}: {
  label: string
  value: number
  tone: 'income' | 'expense' | 'balance'
  helper?: string
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
      <div>
        <p className="flex items-center gap-2 text-sm leading-5 text-muted-foreground">
          <ToneIcon className={`size-4 ${labelToneClass}`} />
          {label}
        </p>
        {helper ? (
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        ) : null}
      </div>
      <p className={`text-lg font-semibold leading-6 ${valueToneClass}`}>
        {formatBalanceCell(value)}
      </p>
    </div>
  )
}

function ForecastTotalsTable({ forecast }: { forecast: RecurrenceForecastResponse }) {
  const blocks = [
    {
      key: 'income',
      label: 'Receitas',
      real: forecast.totals.real.income,
      projected: forecast.totals.projected.income,
      combined: forecast.totals.combined.income,
      tone: 'income' as const,
    },
    {
      key: 'expense',
      label: 'Despesas',
      real: forecast.totals.real.expense,
      projected: forecast.totals.projected.expense,
      combined: forecast.totals.combined.expense,
      tone: 'expense' as const,
    },
    {
      key: 'balance',
      label: 'Resultado',
      real: forecast.totals.real.balance,
      projected: forecast.totals.projected.balance,
      combined: forecast.totals.combined.balance,
      tone: 'balance' as const,
    },
  ]

  return (
    <section className="rounded-lg border border-sky-500/30 bg-sky-500/5">
      <div className="border-b border-sky-500/20 px-3 py-2">
        <h2 className="text-sm font-semibold">Visão com projeção (real + projetado)</h2>
        <p className="text-xs text-muted-foreground">
          Meses futuros mostram parcela projetada sem materializar lançamentos no banco.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="sticky left-0 z-10 min-w-[170px] bg-muted/40 px-3 py-2 font-medium">
                Indicador
              </th>
              {monthLabels.map((label) => (
                <th key={`forecast-head-${label}`} className="px-2 py-2 text-center font-medium">
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total/Ano</th>
            </tr>
          </thead>
          <tbody>
            {blocks.flatMap((block) => [
              <tr key={`${block.key}-real`} className="border-b">
                <td className="sticky left-0 bg-background px-3 py-2 font-medium">
                  {block.label} (real)
                </td>
                {block.real.months.map((value, index) => (
                  <td
                    key={`${block.key}-real-${index}`}
                    className={`px-2 py-2 text-center ${getForecastToneClass(block.tone, value)}`}
                  >
                    {formatBalanceCell(value)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right ${getForecastToneClass(block.tone, block.real.yearTotal)}`}>
                  {formatBalanceCell(block.real.yearTotal)}
                </td>
              </tr>,
              <tr key={`${block.key}-projected`} className="border-b bg-sky-500/5">
                <td className="sticky left-0 bg-sky-500/5 px-3 py-2 font-medium text-sky-600">
                  {block.label} (projetado)
                </td>
                {block.projected.months.map((value, index) => (
                  <td
                    key={`${block.key}-projected-${index}`}
                    className={`px-2 py-2 text-center ${getForecastToneClass(block.tone, value)}`}
                  >
                    {formatBalanceCell(value)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right ${getForecastToneClass(block.tone, block.projected.yearTotal)}`}>
                  {formatBalanceCell(block.projected.yearTotal)}
                </td>
              </tr>,
              <tr key={`${block.key}-combined`} className="border-b bg-muted/10">
                <td className="sticky left-0 bg-muted/10 px-3 py-2 font-semibold">
                  {block.label} (combinado)
                </td>
                {block.combined.months.map((value, index) => (
                  <td
                    key={`${block.key}-combined-${index}`}
                    className={`px-2 py-2 text-center font-semibold ${getForecastToneClass(block.tone, value)}`}
                  >
                    {formatBalanceCell(value)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right font-semibold ${getForecastToneClass(block.tone, block.combined.yearTotal)}`}>
                  {formatBalanceCell(block.combined.yearTotal)}
                </td>
              </tr>,
            ])}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function getForecastToneClass(
  tone: 'income' | 'expense' | 'balance',
  value: number,
) {
  if (tone === 'income') return 'text-emerald-600'
  if (tone === 'expense') return 'text-rose-600'
  if (value > 0) return 'text-emerald-600'
  if (value < 0) return 'text-rose-600'
  return 'text-muted-foreground'
}

function BalanceSectionTable({
  sectionLabel,
  sectionTone,
  data,
  totals,
}: {
  sectionLabel: string
  sectionTone: 'income' | 'expense'
  data: ConsolidatedLine[]
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

  const monthlyVariationPercents = useMemo(
    () => calculateMonthlyVariationPercents(totals.months),
    [totals.months],
  )

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
                <th
                  key={`${sectionLabel}-${label}`}
                  className="px-2 py-2 text-center font-medium"
                >
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total/Ano</th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-b bg-muted/10">
              <td className="sticky left-0 bg-muted/10 px-3 py-2 text-xs font-medium text-muted-foreground">
                Variação vs mês anterior (%)
              </td>
              {monthlyVariationPercents.map((value, index) => (
                <td
                  key={`${sectionLabel}-variation-${index}`}
                  className={`px-2 py-2 text-center text-xs font-medium ${getVariationToneClass(sectionTone, value)}`}
                >
                  {formatVariationPercent(value)}
                </td>
              ))}
              <td className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                -
              </td>
            </tr>

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
                  className={`px-2 py-2 font-bold ${getBalanceCellAlignmentClass(value)}`}
                >
                  {formatBalanceCell(value)}
                </td>
              ))}
              <td
                className={`px-3 py-2 font-bold ${getBalanceCellAlignmentClass(
                  totals.yearTotal,
                )}`}
              >
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
  category: ConsolidatedLine
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
            className={`px-2 py-2 font-medium ${getBalanceCellAlignmentClass(value)}`}
          >
            {formatBalanceCell(value)}
          </td>
        ))}
        <td
          className={`px-3 py-2 font-semibold ${getBalanceCellAlignmentClass(
            category.yearTotal,
          )}`}
        >
          {formatBalanceCell(category.yearTotal)}
        </td>
      </tr>

      {!isCollapsed &&
        category.subcategories.map((subcategory) => (
        <tr key={subcategory.subcategoryId} className="border-b">
          <td className="sticky left-0 bg-background px-3 py-2 text-muted-foreground">
            <span className="inline-block pl-4">
              {resolveSubcategoryDisplayName(
                category.categoryName,
                subcategory.subcategoryName,
              )}
            </span>
          </td>
          {subcategory.months.map((value, index) => (
            <td
              key={`${subcategory.subcategoryId}-month-${index}`}
              className={`px-2 py-2 text-muted-foreground ${getBalanceCellAlignmentClass(value)}`}
            >
              {formatBalanceCell(value)}
            </td>
          ))}
          <td
            className={`px-3 py-2 text-muted-foreground ${getBalanceCellAlignmentClass(
              subcategory.yearTotal,
            )}`}
          >
            {formatBalanceCell(subcategory.yearTotal)}
          </td>
        </tr>
        ))}
    </>
  )
}

function resolveSubcategoryDisplayName(
  categoryName: string,
  subcategoryName: string,
) {
  const normalized = subcategoryName.trim().toLowerCase()
  if (
    normalized === 'sem subcategoria' ||
    normalized === 'sem categoria'
  ) {
    return `${categoryName} *`
  }

  return subcategoryName
}

function formatBalanceCell(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return '-'
  }
  return `$ ${formatCurrencyValue(value)}`
}

function getBalanceCellAlignmentClass(value: number) {
  return value === 0 || !Number.isFinite(value) ? 'text-center' : 'text-right'
}

function getMonthlyBalanceToneClass(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return 'text-muted-foreground'
  }
  return value > 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'
}

function getMonthlyBalanceVariationToneClass(value: number | null) {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return 'text-muted-foreground'
  }
  return value > 0 ? 'text-emerald-400' : 'text-rose-400'
}

function formatBalanceDelta(value: number | null) {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return '-'
  }
  return `${value > 0 ? '+' : '-'}$ ${formatCurrencyValue(Math.abs(value))}`
}

function calculateMonthlyVariationPercents(months: number[]) {
  return months.map((currentValue, index) => {
    if (index === 0) {
      return null
    }

    const previousValue = months[index - 1]
    if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
      return null
    }

    if (previousValue === 0) {
      return currentValue === 0 ? 0 : null
    }

    return ((currentValue - previousValue) / Math.abs(previousValue)) * 100
  })
}

function formatVariationPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '-'
  }

  if (value === 0) {
    return '-'
  }

  const formatted = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  return `${value > 0 ? '+' : '-'}${formatted}%`
}

function getVariationToneClass(
  sectionTone: 'income' | 'expense',
  value: number | null,
) {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return 'text-muted-foreground'
  }

  if (sectionTone === 'income') {
    return value > 0 ? 'text-emerald-400' : 'text-rose-400'
  }

  return value > 0 ? 'text-rose-400' : 'text-emerald-400'
}
