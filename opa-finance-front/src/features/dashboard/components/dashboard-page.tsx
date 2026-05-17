import { Link } from '@tanstack/react-router'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import {
  useMemo,
  type ClipboardEventHandler,
  type KeyboardEventHandler,
  type MouseEventHandler,
} from 'react'

import { Button } from '@/components/ui/button'
import { useAccounts } from '@/features/accounts'
import { DashboardAccountsCard } from '@/features/dashboard/components/dashboard-accounts-card'
import { DashboardCashflowCard } from '@/features/dashboard/components/dashboard-cashflow-card'
import { DashboardCategoryBreakdownCard } from '@/features/dashboard/components/dashboard-category-breakdown-card'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { DashboardRecentTransactionsCard } from '@/features/dashboard/components/dashboard-recent-transactions-card'
import { DashboardSummaryCards } from '@/features/dashboard/components/dashboard-summary-cards'
import { DashboardTopCategoriesCard } from '@/features/dashboard/components/dashboard-top-categories-card'
import { DashboardTopCategoryTransactionsModal } from '@/features/dashboard/components/dashboard-top-category-transactions-modal'
import { DashboardTransactionDetailsModal } from '@/features/dashboard/components/dashboard-transaction-details-modal'
import { useDashboardInteractions } from '@/features/dashboard/hooks/use-dashboard-interactions'
import { useDashboardPanels } from '@/features/dashboard/hooks/use-dashboard-panels'
import { useDashboardSearchParams } from '@/features/dashboard/hooks/use-dashboard-search-params'
import {
  buildDashboardBaseQueryParams,
  buildDashboardCashflowQueryParams,
  buildDashboardCategoryBreakdownQueryParams,
  buildDashboardRecentTransactionsQueryParams,
  buildDashboardSummaryQueryParams,
  buildDashboardTopCategoriesQueryParams,
  buildDashboardTopCategoryTransactionsQueryParams,
  resolveCashflowGranularity,
} from '@/features/dashboard/mappers/dashboard-query.mapper'
import {
  formatDashboardDateDisplay,
  formatDashboardDateInput,
} from '@/features/dashboard/model/dashboard.helpers'
import type {
  DashboardNavigateFn,
  DashboardSearchParams,
} from '@/features/dashboard/model/dashboard.types'
import {
  useTransactions,
  useTransactionsCashflow,
  useTransactionsCategoryBreakdown,
  useTransactionsTopCategories,
  useTransactionsSummary,
} from '@/features/transactions'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getApiErrorMessage } from '@/lib/apiError'

type DashboardPageProps = {
  search: DashboardSearchParams
  navigate: DashboardNavigateFn
}

export function DashboardPage({ search, navigate }: DashboardPageProps) {
  const {
    isTransactionsOpen,
    isTopExpensesOpen,
    isTopIncomeOpen,
    expenseGroupBy,
    incomeGroupBy,
    selectedTopCategory,
    toggleTransactionsOpen,
    toggleTopExpensesOpen,
    toggleTopIncomeOpen,
    updateExpenseGroupBy,
    updateIncomeGroupBy,
    selectExpenseTopCategory,
    selectIncomeTopCategory,
    clearSelectedTopCategory,
  } = useDashboardPanels()
  const {
    selectedTransaction,
    setSelectedTransaction,
    detailCopiedField,
    detailModalRef,
    handleCopyDetail,
  } = useDashboardInteractions({
    hasSelectedTopCategory: Boolean(selectedTopCategory),
    clearSelectedTopCategory,
  })
  const isMobile = useMediaQuery('(max-width: 639px)')

  const accountsQuery = useAccounts()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const dashboardAccounts = useMemo(
    () => accounts.filter((account) => !account.isHiddenOnDashboard),
    [accounts],
  )
  const {
    period,
    customStartDate,
    customEndDate,
    startDate,
    endDate,
    isAccountParamAll,
    resolvedAccountId,
    effectiveAccountId,
    canQueryAccount,
    handlePeriodChange,
    handleAccountChange,
    handleCustomDateChange,
  } = useDashboardSearchParams({
    search,
    navigate,
    dashboardAccounts,
    accountsLoaded: accountsQuery.isSuccess,
  })

  const baseQueryParams = buildDashboardBaseQueryParams({
    startDate,
    endDate,
    isAccountParamAll,
    resolvedAccountId: resolvedAccountId || undefined,
  })

  const summaryQuery = useTransactionsSummary(
    buildDashboardSummaryQueryParams(baseQueryParams),
    { enabled: canQueryAccount },
  )
  const transactionsQuery = useTransactions(
    buildDashboardRecentTransactionsQueryParams(baseQueryParams),
    { enabled: canQueryAccount },
  )
  const topExpensesQuery = useTransactionsTopCategories(
    buildDashboardTopCategoriesQueryParams(baseQueryParams, {
      type: 'expense',
      groupBy: expenseGroupBy,
    }),
    { enabled: canQueryAccount },
  )
  const topIncomeQuery = useTransactionsTopCategories(
    buildDashboardTopCategoriesQueryParams(baseQueryParams, {
      type: 'income',
      groupBy: incomeGroupBy,
    }),
    { enabled: canQueryAccount },
  )
  const cashflowGranularity = resolveCashflowGranularity(startDate, endDate)
  const cashflowQuery = useTransactionsCashflow(
    buildDashboardCashflowQueryParams(baseQueryParams),
    { enabled: canQueryAccount },
  )
  const categoryBreakdownQuery = useTransactionsCategoryBreakdown(
    buildDashboardCategoryBreakdownQueryParams(baseQueryParams, {
      type: 'expense',
    }),
    { enabled: canQueryAccount },
  )

  const visibleAccounts = [...dashboardAccounts].sort((a, b) => {
    const aPrimary = a.isPrimary ? 1 : 0
    const bPrimary = b.isPrimary ? 1 : 0
    if (aPrimary !== bPrimary) {
      return bPrimary - aPrimary
    }
    return a.name.localeCompare(b.name)
  })
  const recentTransactions = transactionsQuery.data?.data ?? []
  const topExpenseItems = topExpensesQuery.data ?? []
  const topIncomeItems = topIncomeQuery.data ?? []
  const summary = summaryQuery.data
  const summaryError = summaryQuery.isError
    ? getApiErrorMessage(summaryQuery.error)
    : null
  const transactionsError = transactionsQuery.isError
    ? getApiErrorMessage(transactionsQuery.error)
    : null
  const topExpensesError = topExpensesQuery.isError
    ? getApiErrorMessage(topExpensesQuery.error)
    : null
  const topIncomeError = topIncomeQuery.isError
    ? getApiErrorMessage(topIncomeQuery.error)
    : null
  const cashflowError = cashflowQuery.isError
    ? getApiErrorMessage(cashflowQuery.error)
    : null
  const cashflowData = useMemo(() => {
    const today = formatDashboardDateInput(new Date())
    return (cashflowQuery.data ?? []).filter((point) => point.bucket <= today)
  }, [cashflowQuery.data])
  const categoryBreakdownError = categoryBreakdownQuery.isError
    ? getApiErrorMessage(categoryBreakdownQuery.error)
    : null
  const categoryBreakdownItems = categoryBreakdownQuery.data ?? []
  const dateFormatter = new Intl.DateTimeFormat('pt-BR')
  const accountTypeLabels: Record<string, string> = {
    cash: 'Dinheiro',
    checking_account: 'Conta Corrente',
    savings_account: 'Poupança',
    credit_card: 'Cartão de Crédito',
    investment: 'Investimento',
  }
  const accountMap = new Map(
    accounts.map((account) => [account.id, account.name]),
  )
  const totalAccountsBalance = visibleAccounts.reduce(
    (total, account) => total + (account.currentBalance ?? 0),
    0,
  )

  const topCategoryTransactionsQuery = useTransactions(
    buildDashboardTopCategoryTransactionsQueryParams(
      baseQueryParams,
      selectedTopCategory,
    ),
    { enabled: canQueryAccount && Boolean(selectedTopCategory) },
  )
  const showSummarySkeleton =
    accountsQuery.isLoading || (canQueryAccount && summaryQuery.isLoading)
  const showTransactionsSkeleton =
    accountsQuery.isLoading || (canQueryAccount && transactionsQuery.isLoading)
  const showTopExpensesSkeleton =
    accountsQuery.isLoading || (canQueryAccount && topExpensesQuery.isLoading)
  const showTopIncomeSkeleton =
    accountsQuery.isLoading || (canQueryAccount && topIncomeQuery.isLoading)
  const showCashflowSkeleton =
    accountsQuery.isLoading || (canQueryAccount && cashflowQuery.isLoading)
  const showCategoryBreakdownSkeleton =
    accountsQuery.isLoading || (canQueryAccount && categoryBreakdownQuery.isLoading)
  const showAccountsSkeleton = accountsQuery.isLoading
  const handleMobileDateKeyDown: KeyboardEventHandler<HTMLInputElement> = (
    event,
  ) => {
    if (isMobile) {
      event.preventDefault()
    }
  }
  const handleMobileDatePaste: ClipboardEventHandler<HTMLInputElement> = (
    event,
  ) => {
    if (isMobile) {
      event.preventDefault()
    }
  }
  const handleMobileDateClick: MouseEventHandler<HTMLInputElement> = (
    event,
  ) => {
    if (!isMobile) {
      return
    }
    const target = event.currentTarget
    if (typeof target.showPicker === 'function') {
      target.showPicker()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
        </div>

        <DashboardFilters
          period={period}
          isAccountParamAll={isAccountParamAll}
          resolvedAccountId={resolvedAccountId ?? ''}
          dashboardAccounts={dashboardAccounts}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          startDate={startDate}
          endDate={endDate}
          isMobile={isMobile}
          onPeriodChange={handlePeriodChange}
          onAccountChange={handleAccountChange}
          onCustomDateChange={handleCustomDateChange}
          onMobileDateClick={handleMobileDateClick}
          onMobileDateKeyDown={handleMobileDateKeyDown}
          onMobileDatePaste={handleMobileDatePaste}
        />
      </div>

      <DashboardSummaryCards
        showSummarySkeleton={showSummarySkeleton}
        summary={summary}
      />

      {summaryError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
          {summaryError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardCashflowCard
          className="lg:col-span-2"
          showSkeleton={showCashflowSkeleton}
          errorMessage={cashflowError}
          data={cashflowData}
          granularity={cashflowGranularity}
        />
        <DashboardCategoryBreakdownCard
          showSkeleton={showCategoryBreakdownSkeleton}
          errorMessage={categoryBreakdownError}
          items={categoryBreakdownItems}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DashboardRecentTransactionsCard
            isOpen={isTransactionsOpen}
            showSkeleton={showTransactionsSkeleton}
            errorMessage={transactionsError}
            transactions={recentTransactions}
            onToggleOpen={toggleTransactionsOpen}
            onOpenTransaction={setSelectedTransaction}
            formatDateDisplay={(value) =>
              formatDashboardDateDisplay(value, dateFormatter)
            }
            viewAllAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/app/transactions">Ver todas</Link>
              </Button>
            }
          />

          <DashboardTopCategoriesCard
            title="Top 5 Despesas"
            icon={<ArrowDownRight className="h-6 w-6 text-rose-500" />}
            isOpen={isTopExpensesOpen}
            groupBy={expenseGroupBy}
            showSkeleton={showTopExpensesSkeleton}
            errorMessage={topExpensesError}
            emptyMessage="Nenhum gasto encontrado no período."
            items={topExpenseItems}
            onToggleOpen={toggleTopExpensesOpen}
            onToggleGroupBySubcategory={updateExpenseGroupBy}
            onSelectItem={selectExpenseTopCategory}
            viewAllAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/app/categories">Ver todas</Link>
              </Button>
            }
          />

          <DashboardTopCategoriesCard
            title="Top 5 Receitas"
            icon={<ArrowUpRight className="h-6 w-6 text-emerald-500" />}
            isOpen={isTopIncomeOpen}
            groupBy={incomeGroupBy}
            showSkeleton={showTopIncomeSkeleton}
            errorMessage={topIncomeError}
            emptyMessage="Nenhuma receita encontrada no período."
            items={topIncomeItems}
            onToggleOpen={toggleTopIncomeOpen}
            onToggleGroupBySubcategory={updateIncomeGroupBy}
            onSelectItem={selectIncomeTopCategory}
            viewAllAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/app/categories">Ver todas</Link>
              </Button>
            }
          />
        </div>

        <DashboardAccountsCard
          showSkeleton={showAccountsSkeleton}
          isError={accountsQuery.isError}
          errorMessage={
            accountsQuery.isError ? getApiErrorMessage(accountsQuery.error) : null
          }
          allAccountsCount={accounts.length}
          visibleAccounts={visibleAccounts}
          selectedAccountId={effectiveAccountId}
          totalBalance={totalAccountsBalance}
          accountTypeLabels={accountTypeLabels}
          onSelectAccount={handleAccountChange}
        />
      </div>

      <DashboardTopCategoryTransactionsModal
        selectedTopCategory={selectedTopCategory}
        isLoading={topCategoryTransactionsQuery.isLoading}
        errorMessage={
          topCategoryTransactionsQuery.isError
            ? getApiErrorMessage(topCategoryTransactionsQuery.error)
            : null
        }
        transactions={topCategoryTransactionsQuery.data?.data ?? []}
        onClose={clearSelectedTopCategory}
        onOpenTransaction={setSelectedTransaction}
        formatDateDisplay={(value) =>
          formatDashboardDateDisplay(value, dateFormatter)
        }
        viewAllAction={
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link
              to="/app/transactions"
              search={{
                page: 1,
                accountId: isAccountParamAll ? undefined : resolvedAccountId,
                startDate,
                endDate,
                categoryId:
                  selectedTopCategory?.groupBy === 'category'
                    ? selectedTopCategory.id
                    : undefined,
                subcategoryId:
                  selectedTopCategory?.groupBy === 'subcategory'
                    ? selectedTopCategory.id
                    : undefined,
                type: selectedTopCategory?.type,
              }}
            >
              Ver todas
            </Link>
          </Button>
        }
      />

      <DashboardTransactionDetailsModal
        selectedTransaction={selectedTransaction}
        accountNameById={accountMap}
        copiedField={detailCopiedField}
        modalRef={detailModalRef}
        onClose={() => setSelectedTransaction(null)}
        onCopyDetail={handleCopyDetail}
        formatDateDisplay={(value) =>
          formatDashboardDateDisplay(value, dateFormatter)
        }
      />
    </div>
  )
}
