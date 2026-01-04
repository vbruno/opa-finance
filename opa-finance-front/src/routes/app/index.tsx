import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/features/accounts'
import {
  useTransactions,
  useTransactionsTopCategories,
  useTransactionsSummary,
} from '@/features/transactions'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'

export const Route = createFileRoute('/app/')({
  validateSearch: z.object({
    period: z
      .preprocess(
        (value) => {
          const allowed = [
            'month',
            'previousMonth',
            'last7',
            'last15',
            'last30',
            'custom',
          ]
          if (typeof value !== 'string') {
            return undefined
          }
          return allowed.includes(value) ? value : undefined
        },
        z.enum([
          'month',
          'previousMonth',
          'last7',
          'last15',
          'last30',
          'custom',
        ]),
      )
      .optional(),
    accountId: z.string().optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  component: Dashboard,
})

function Dashboard() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const period = search.period ?? 'month'
  const accountParam = search.accountId
  const accountFilter = accountParam === 'all' ? '' : accountParam ?? ''
  const customStartDate = search.startDate ?? ''
  const customEndDate = search.endDate ?? ''
  const [groupBy, setGroupBy] = useState<'category' | 'subcategory'>(
    'category',
  )
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(true)
  const [isTopCategoriesOpen, setIsTopCategoriesOpen] = useState(true)
  const { startDate, endDate } = getDateRange(
    period,
    customStartDate,
    customEndDate,
  )

  const accountsQuery = useAccounts()
  const accounts = accountsQuery.data ?? []
  const primaryAccount =
    accounts.find((account) => account.isPrimary) ?? accounts[0]
  const effectiveAccountId =
    accountParam && accountParam !== 'all'
      ? accountParam
      : primaryAccount?.id || ''

  const summaryQuery = useTransactionsSummary({
    startDate,
    endDate,
    accountId: accountParam === 'all' ? undefined : effectiveAccountId || undefined,
  })
  const transactionsQuery = useTransactions({
    page: 1,
    limit: 5,
    startDate,
    endDate,
    accountId: accountParam === 'all' ? undefined : effectiveAccountId || undefined,
    sort: 'date',
    dir: 'desc',
  })
  const topCategoriesQuery = useTransactionsTopCategories({
    startDate,
    endDate,
    accountId: accountParam === 'all' ? undefined : effectiveAccountId || undefined,
    groupBy,
  })

  const visibleAccounts = [...accounts].sort((a, b) => {
    const aPrimary = a.isPrimary ? 1 : 0
    const bPrimary = b.isPrimary ? 1 : 0
    if (aPrimary !== bPrimary) {
      return bPrimary - aPrimary
    }
    return a.name.localeCompare(b.name)
  })
  const recentTransactions = transactionsQuery.data?.data ?? []
  const summary = summaryQuery.data
  const summaryError = summaryQuery.isError
    ? getApiErrorMessage(summaryQuery.error)
    : null
  const transactionsError = transactionsQuery.isError
    ? getApiErrorMessage(transactionsQuery.error)
    : null
  const topCategoriesError = topCategoriesQuery.isError
    ? getApiErrorMessage(topCategoriesQuery.error)
    : null
  const dateFormatter = new Intl.DateTimeFormat('pt-BR')
  const accountTypeLabels: Record<string, string> = {
    cash: 'Dinheiro',
    checking_account: 'Conta Corrente',
    savings_account: 'Poupança',
    credit_card: 'Cartão de Crédito',
    investment: 'Investimento',
  }

  useEffect(() => {
    if (accountParam === undefined && primaryAccount?.id) {
      navigate({
        search: (prev) => ({
          ...prev,
          accountId: primaryAccount.id,
        }),
      })
    }
  }, [accountParam, navigate, primaryAccount?.id])

  function handlePeriodChange(value: string) {
    if (value === 'custom') {
      navigate({
        search: (prev) => ({
          ...prev,
          period: 'custom',
          startDate,
          endDate,
        }),
      })
      return
    }

    navigate({
      search: (prev) => ({
        ...prev,
        period: value as
          | 'month'
          | 'previousMonth'
          | 'last7'
          | 'last15'
          | 'last30',
        startDate: undefined,
        endDate: undefined,
      }),
    })
  }

  function handleAccountChange(value: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        accountId: value === 'all' ? 'all' : value || undefined,
      }),
    })
  }

  function handleCustomDateChange(key: 'startDate' | 'endDate', value: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        [key]: value || undefined,
      }),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão rápida das suas finanças no período selecionado.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="min-w-[180px] space-y-1">
            <Label htmlFor="period">Período</Label>
            <select
              id="period"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={period}
              onChange={(event) => handlePeriodChange(event.target.value)}
            >
              <option value="month">Mês atual</option>
              <option value="previousMonth">Mês anterior</option>
              <option value="last7">Últimos 7 dias</option>
              <option value="last15">Últimos 15 dias</option>
              <option value="last30">Últimos 30 dias</option>
              <option value="custom">Customizado</option>
            </select>
          </div>

          <div className="min-w-[200px] space-y-1">
            <Label htmlFor="account">Conta</Label>
            <select
              id="account"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={
                accountParam === 'all'
                  ? 'all'
                  : accountParam ?? primaryAccount?.id ?? ''
              }
              onChange={(event) => handleAccountChange(event.target.value)}
            >
              <option value="all">Todas as contas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {period === 'custom' && (
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[160px] space-y-1">
                <Label htmlFor="startDate">Início</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={customStartDate || startDate}
                  onChange={(event) =>
                    handleCustomDateChange('startDate', event.target.value)
                  }
                />
              </div>
              <div className="min-w-[160px] space-y-1">
                <Label htmlFor="endDate">Fim</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={customEndDate || endDate}
                  onChange={(event) =>
                    handleCustomDateChange('endDate', event.target.value)
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Receitas</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {summary ? formatCurrencyValue(summary.income) : '--'}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Despesas</p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">
            {summary ? formatCurrencyValue(summary.expense) : '--'}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className="mt-2 text-2xl font-semibold">
            {summary ? formatCurrencyValue(summary.balance) : '--'}
          </p>
        </div>
      </div>

      {summaryError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
          {summaryError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setIsTransactionsOpen((prev) => !prev)}
                  aria-label={
                    isTransactionsOpen
                      ? 'Recolher transações'
                      : 'Expandir transações'
                  }
                >
                  {isTransactionsOpen ? '-' : '+'}
                </Button>
                <div>
                  <h2 className="text-lg font-semibold">
                    Últimas transações
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    As 5 transações mais recentes no período.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/transactions">Ver todas</Link>
                </Button>
              </div>
            </div>

            {isTransactionsOpen && (
              <div className="mt-4 space-y-3">
                {transactionsQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">
                  Carregando transações...
                  </p>
                )}
                {transactionsError && (
                  <p className="text-sm text-destructive">
                    {transactionsError}
                  </p>
                )}
                {!transactionsQuery.isLoading &&
                  !transactionsError &&
                  recentTransactions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                    Nenhuma transação encontrada no período.
                    </p>
                  )}
                {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                        {transaction.description || 'Sem descrição'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {transaction.subcategoryName ||
                        transaction.categoryName ||
                        'Sem categoria'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span
                      className={
                        transaction.type === 'income'
                          ? 'font-semibold text-emerald-600'
                          : 'font-semibold text-rose-600'
                      }
                    >
                      {transaction.type === 'income' ? '+' : '-'}{' '}
                      {formatCurrencyValue(transaction.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {dateFormatter.format(new Date(transaction.date))}
                    </span>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setIsTopCategoriesOpen((prev) => !prev)}
                  aria-label={
                    isTopCategoriesOpen
                      ? 'Recolher top categorias'
                      : 'Expandir top categorias'
                  }
                >
                  {isTopCategoriesOpen ? '-' : '+'}
                </Button>
                <div>
                  <h2 className="text-lg font-semibold">
                    Top 5 Categorias
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {groupBy === 'subcategory'
                      ? 'Subcategorias com mais gastos.'
                      : 'Categorias com mais gastos.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isTopCategoriesOpen && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      checked={groupBy === 'subcategory'}
                      onChange={(event) =>
                        setGroupBy(
                          event.target.checked ? 'subcategory' : 'category',
                        )
                      }
                    />
                    Subcategoria
                  </label>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/categories">Ver todas</Link>
                </Button>
              </div>
            </div>

            {isTopCategoriesOpen && (
              <div className="mt-4 space-y-3">
                {topCategoriesQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Carregando top gastos...
                  </p>
                )}
                {topCategoriesError && (
                  <p className="text-sm text-destructive">
                    {topCategoriesError}
                  </p>
                )}
                {!topCategoriesQuery.isLoading &&
                  !topCategoriesError &&
                  (topCategoriesQuery.data?.length ?? 0) === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum gasto encontrado no período.
                    </p>
                  )}
                {(topCategoriesQuery.data ?? []).map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.categoryName && (
                          <p className="text-xs text-muted-foreground">
                            {item.categoryName}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrencyValue(item.totalAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(item.percentage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <div>
            <h2 className="text-lg font-semibold">Contas</h2>
            <p className="text-sm text-muted-foreground">
              Saldo atual por conta.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {accountsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Carregando contas...
              </p>
            )}
            {accountsQuery.isError && (
              <p className="text-sm text-destructive">
                {getApiErrorMessage(accountsQuery.error)}
              </p>
            )}
            {!accountsQuery.isLoading &&
              !accountsQuery.isError &&
              visibleAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta cadastrada.
                </p>
              )}
            {visibleAccounts.map((account) => (
              <div
                key={account.id}
                className={
                  account.id === effectiveAccountId
                    ? 'flex items-center justify-between rounded-md border border-primary/60 bg-primary/5 p-3'
                    : 'flex items-center justify-between rounded-md border p-3'
                }
              >
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {accountTypeLabels[account.type] ?? account.type}
                    {account.isPrimary && (
                      <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">
                        Principal
                      </span>
                    )}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatCurrencyValue(
                    account.currentBalance ?? account.initialBalance ?? 0,
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getDateRange(
  period:
    | 'month'
    | 'previousMonth'
    | 'last7'
    | 'last15'
    | 'last30'
    | 'custom',
  customStartDate: string,
  customEndDate: string,
) {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const previousMonthStart = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1,
  )
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const last7Start = new Date(today)
  last7Start.setDate(today.getDate() - 6)
  const last15Start = new Date(today)
  last15Start.setDate(today.getDate() - 14)
  const last30Start = new Date(today)
  last30Start.setDate(today.getDate() - 29)

  if (period === 'previousMonth') {
    return {
      startDate: formatDateInput(previousMonthStart),
      endDate: formatDateInput(previousMonthEnd),
    }
  }

  if (period === 'last7') {
    return {
      startDate: formatDateInput(last7Start),
      endDate: formatDateInput(today),
    }
  }

  if (period === 'last15') {
    return {
      startDate: formatDateInput(last15Start),
      endDate: formatDateInput(today),
    }
  }

  if (period === 'last30') {
    return {
      startDate: formatDateInput(last30Start),
      endDate: formatDateInput(today),
    }
  }

  if (period === 'custom') {
    return {
      startDate: customStartDate || formatDateInput(monthStart),
      endDate: customEndDate || formatDateInput(monthEnd),
    }
  }

  return {
    startDate: formatDateInput(monthStart),
    endDate: formatDateInput(monthEnd),
  }
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
