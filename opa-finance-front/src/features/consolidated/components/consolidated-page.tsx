import { BarChart3, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAccounts } from '@/features/accounts'
import { ConsolidatedBalanceSectionTable } from '@/features/consolidated/components/consolidated-balance-section-table'
import { ConsolidatedForecastTotalsTable } from '@/features/consolidated/components/consolidated-forecast-totals-table'
import { ConsolidatedMonthlyBalanceTable } from '@/features/consolidated/components/consolidated-monthly-balance-table'
import { ConsolidatedSkeleton } from '@/features/consolidated/components/consolidated-skeleton'
import { ConsolidatedSummaryCard } from '@/features/consolidated/components/consolidated-summary-card'
import { useConsolidatedSearchParams } from '@/features/consolidated/hooks/use-consolidated-search-params'
import { formatBalanceCell } from '@/features/consolidated/model/consolidated.helpers'
import type {
  ConsolidatedNavigateFn,
  ConsolidatedSearchParams,
} from '@/features/consolidated/model/consolidated.types'
import {
  useConsolidated,
  useConsolidatedYears,
  useRecurrenceForecast,
} from '@/features/reports'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getApiErrorMessage } from '@/lib/apiError'

type ConsolidatedPageProps = {
  search: ConsolidatedSearchParams
  navigate: ConsolidatedNavigateFn
}

export function ConsolidatedPage({ search, navigate }: ConsolidatedPageProps) {
  const isDesktop = useMediaQuery('(min-width: 960px)')
  const currentYear = new Date().getFullYear()

  const accountsQuery = useAccounts()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const [isProjectionEnabled, setIsProjectionEnabled] = useState(false)
  const {
    allAccountIds,
    effectiveAccountIds,
    primaryAccountId,
    setSearch,
    toggleAccount,
    updateSelectedAccounts,
    isAccountDropdownOpen,
    setIsAccountDropdownOpen,
    year,
  } = useConsolidatedSearchParams({
    search,
    navigate,
    accounts,
    currentYear,
  })

  const yearsQuery = useConsolidatedYears(
    {
      accountIds: effectiveAccountIds.length
        ? effectiveAccountIds
        : undefined,
    },
    {
      enabled: isDesktop && effectiveAccountIds.length > 0,
    },
  )

  const yearOptions = useMemo(() => yearsQuery.data?.years ?? [], [yearsQuery.data?.years])
  const hasSelectedYear = yearOptions.includes(year)
  const activeYear = hasSelectedYear || yearOptions.length === 0 ? year : yearOptions[0]

  useEffect(() => {
    if (yearOptions.length === 0) {
      return
    }
    if (yearOptions.includes(year)) {
      return
    }
    setSearch({ year: yearOptions[0] })
  }, [setSearch, year, yearOptions])

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

  const accountDropdownRef = useRef<HTMLDivElement | null>(null)
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
  }, [isAccountDropdownOpen, setIsAccountDropdownOpen])

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
      ? accounts.find((account) => account.id === selectedIdsForUi[0])?.name ?? null
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
    (!yearsQuery.isLoading && !yearsQuery.isError && yearOptions.length === 0) ||
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
              onClick={() => setIsAccountDropdownOpen((currentOpen) => !currentOpen)}
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
                      onChange={() => setSearch({ accountIds: primaryAccountId ?? undefined })}
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
                        updateSelectedAccounts(event.target.checked ? allAccountIds : [])
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
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Carregando contas...</div>
      ) : null}

      {accountsQuery.isError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">
          {getApiErrorMessage(accountsQuery.error)}
        </div>
      ) : null}

      {showBalanceSkeleton ? <ConsolidatedSkeleton /> : null}

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
            <ConsolidatedSummaryCard
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
            <ConsolidatedSummaryCard
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
            <ConsolidatedSummaryCard
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
            <ConsolidatedForecastTotalsTable forecast={recurrenceForecastQuery.data} />
          ) : null}

          <ConsolidatedBalanceSectionTable
            sectionLabel="Receitas"
            sectionTone="income"
            data={consolidatedQuery.data.income}
            totals={consolidatedQuery.data.totals.income}
          />

          <ConsolidatedBalanceSectionTable
            sectionLabel="Despesas"
            sectionTone="expense"
            data={consolidatedQuery.data.expense}
            totals={consolidatedQuery.data.totals.expense}
          />

          <ConsolidatedMonthlyBalanceTable
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
