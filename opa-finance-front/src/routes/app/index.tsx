import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/features/accounts'
import {
  useTransactions,
  useTransactionsSummary,
} from '@/features/transactions'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'

export const Route = createFileRoute('/app/')({
  validateSearch: z.object({
    period: z
      .preprocess(
        (value) => {
          const allowed = ['month', 'last30', 'custom']
          if (typeof value !== 'string') {
            return undefined
          }
          return allowed.includes(value) ? value : undefined
        },
        z.enum(['month', 'last30', 'custom']),
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
  const accountFilter = search.accountId ?? ''
  const customStartDate = search.startDate ?? ''
  const customEndDate = search.endDate ?? ''
  const { startDate, endDate } = getDateRange(
    period,
    customStartDate,
    customEndDate,
  )

  const accountsQuery = useAccounts()
  const summaryQuery = useTransactionsSummary({
    startDate,
    endDate,
    accountId: accountFilter || undefined,
  })
  const transactionsQuery = useTransactions({
    page: 1,
    limit: 8,
    startDate,
    endDate,
    accountId: accountFilter || undefined,
    sort: 'date',
    dir: 'desc',
  })

  const accounts = accountsQuery.data ?? []
  const visibleAccounts = accountFilter
    ? accounts.filter((account) => account.id === accountFilter)
    : accounts
  const recentTransactions = transactionsQuery.data?.data ?? []
  const summary = summaryQuery.data
  const summaryError = summaryQuery.isError
    ? getApiErrorMessage(summaryQuery.error)
    : null
  const transactionsError = transactionsQuery.isError
    ? getApiErrorMessage(transactionsQuery.error)
    : null
  const dateFormatter = new Intl.DateTimeFormat('pt-BR')
  const accountTypeLabels: Record<string, string> = {
    cash: 'Dinheiro',
    checking_account: 'Conta Corrente',
    savings_account: 'Poupanca',
    credit_card: 'Cartao de Credito',
    investment: 'Investimento',
  }

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
        period: value as 'month' | 'last30',
        startDate: undefined,
        endDate: undefined,
      }),
    })
  }

  function handleAccountChange(value: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        accountId: value || undefined,
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
            Visao rapida das suas financas no periodo selecionado.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="min-w-[180px] space-y-1">
            <Label htmlFor="period">Periodo</Label>
            <select
              id="period"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={period}
              onChange={(event) => handlePeriodChange(event.target.value)}
            >
              <option value="month">Mes atual</option>
              <option value="last30">Ultimos 30 dias</option>
              <option value="custom">Customizado</option>
            </select>
          </div>

          <div className="min-w-[200px] space-y-1">
            <Label htmlFor="account">Conta</Label>
            <select
              id="account"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={accountFilter}
              onChange={(event) => handleAccountChange(event.target.value)}
            >
              <option value="">Todas as contas</option>
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
                <Label htmlFor="startDate">Inicio</Label>
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
        <div className="rounded-lg border bg-background p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Ultimas transacoes
              </h2>
              <p className="text-sm text-muted-foreground">
                As 8 transacoes mais recentes no periodo.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/transactions">Ver todas</Link>
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {transactionsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Carregando transacoes...
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
                  Nenhuma transacao encontrada no periodo.
                </p>
              )}
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {transaction.description || 'Sem descricao'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.categoryName ?? 'Sem categoria'}
                    {transaction.subcategoryName
                      ? ` - ${transaction.subcategoryName}`
                      : ''}
                    {transaction.accountName
                      ? ` - ${transaction.accountName}`
                      : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={
                      transaction.type === 'income'
                        ? 'font-semibold text-emerald-600'
                        : 'font-semibold text-rose-600'
                    }
                  >
                    {transaction.type === 'income' ? '+' : '-'}{' '}
                    {formatCurrencyValue(transaction.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {dateFormatter.format(new Date(transaction.date))}
                  </p>
                </div>
              </div>
            ))}
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
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {accountTypeLabels[account.type] ?? account.type}
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
  period: 'month' | 'last30' | 'custom',
  customStartDate: string,
  customEndDate: string,
) {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const last30Start = new Date(today)
  last30Start.setDate(today.getDate() - 29)

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
