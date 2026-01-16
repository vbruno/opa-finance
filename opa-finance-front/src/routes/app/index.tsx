import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  List,
  Wallet,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEventHandler,
  type KeyboardEventHandler,
  type MouseEventHandler,
} from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/features/accounts'
import {
  useTransactions,
  useTransactionsTopCategories,
  useTransactionsSummary,
  type Transaction,
} from '@/features/transactions'
import { useMediaQuery } from '@/hooks/useMediaQuery'
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
  const customStartDate = search.startDate ?? ''
  const customEndDate = search.endDate ?? ''
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(true)
  const [isTopExpensesOpen, setIsTopExpensesOpen] = useState(false)
  const [isTopIncomeOpen, setIsTopIncomeOpen] = useState(false)
  const [expenseGroupBy, setExpenseGroupBy] = useState<'category' | 'subcategory'>(
    'category',
  )
  const [incomeGroupBy, setIncomeGroupBy] = useState<'category' | 'subcategory'>(
    'category',
  )
  const [selectedTopCategory, setSelectedTopCategory] = useState<{
    id: string
    name: string
    groupBy: 'category' | 'subcategory'
    type: 'income' | 'expense'
  } | null>(null)
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [detailCopiedField, setDetailCopiedField] = useState<
    'description' | 'amount' | null
  >(null)
  const isMobile = useMediaQuery('(max-width: 639px)')
  const detailModalRef = useRef<HTMLDivElement | null>(null)
  const detailCopyTimeoutRef = useRef<number | null>(null)
  const { startDate, endDate } = getDateRange(
    period,
    customStartDate,
    customEndDate,
  )

  const accountsQuery = useAccounts()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const primaryAccount =
    accounts.find((account) => account.isPrimary) ?? accounts[0]
  const isAccountParamAll = accountParam === 'all'
  const isAccountParamValid = accountParam
    ? accounts.some((account) => account.id === accountParam)
    : false
  const resolvedAccountId =
    !accountParam || isAccountParamAll
      ? primaryAccount?.id
      : isAccountParamValid
        ? accountParam
        : primaryAccount?.id
  const effectiveAccountId = isAccountParamAll
    ? ''
    : resolvedAccountId || ''
  const canQueryAccount =
    accountsQuery.isSuccess &&
    (isAccountParamAll || Boolean(resolvedAccountId))

  const summaryQuery = useTransactionsSummary(
    {
      startDate,
      endDate,
      accountId: isAccountParamAll ? undefined : resolvedAccountId || undefined,
    },
    { enabled: canQueryAccount },
  )
  const transactionsQuery = useTransactions(
    {
      page: 1,
      limit: 5,
      startDate,
      endDate,
      accountId: isAccountParamAll ? undefined : resolvedAccountId || undefined,
      sort: 'date',
      dir: 'desc',
    },
    { enabled: canQueryAccount },
  )
  const topExpensesQuery = useTransactionsTopCategories(
    {
      startDate,
      endDate,
      accountId: isAccountParamAll ? undefined : resolvedAccountId || undefined,
      type: 'expense',
      groupBy: expenseGroupBy,
    },
    { enabled: canQueryAccount },
  )
  const topIncomeQuery = useTransactionsTopCategories(
    {
      startDate,
      endDate,
      accountId: isAccountParamAll ? undefined : resolvedAccountId || undefined,
      type: 'income',
      groupBy: incomeGroupBy,
    },
    { enabled: canQueryAccount },
  )

  const visibleAccounts = [...accounts].sort((a, b) => {
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
    {
      page: 1,
      limit: 5,
      startDate,
      endDate,
      accountId: isAccountParamAll ? undefined : resolvedAccountId || undefined,
      categoryId:
        selectedTopCategory?.groupBy === 'category'
          ? selectedTopCategory.id
          : undefined,
      subcategoryId:
        selectedTopCategory?.groupBy === 'subcategory'
          ? selectedTopCategory.id
          : undefined,
      type: selectedTopCategory?.type,
      sort: 'date',
      dir: 'desc',
    },
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

  useEffect(() => {
    if (!accountParam || accountParam === 'all') {
      return
    }
    const hasAccount = accounts.some((account) => account.id === accountParam)
    if (!hasAccount) {
      navigate({
        search: (prev) => ({
          ...prev,
          accountId: primaryAccount?.id ?? undefined,
        }),
        replace: true,
      })
    }
  }, [accountParam, accounts, navigate, primaryAccount?.id])

  useEffect(() => {
    if (selectedTransaction) {
      detailModalRef.current?.focus()
    }
  }, [selectedTransaction])

  useEffect(() => {
    return () => {
      if (detailCopyTimeoutRef.current) {
        window.clearTimeout(detailCopyTimeoutRef.current)
      }
    }
  }, [])

  const handleCopyDetail = async (
    value: string,
    field: 'description' | 'amount',
  ) => {
    if (!navigator?.clipboard?.writeText) {
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      setDetailCopiedField(field)
      if (detailCopyTimeoutRef.current) {
        window.clearTimeout(detailCopyTimeoutRef.current)
      }
      detailCopyTimeoutRef.current = window.setTimeout(() => {
        setDetailCopiedField(null)
      }, 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  useEffect(() => {
    if (!selectedTopCategory && !selectedTransaction) {
      return
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      if (selectedTransaction) {
        setSelectedTransaction(null)
        return
      }
      if (selectedTopCategory) {
        setSelectedTopCategory(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [selectedTopCategory, selectedTransaction])

  useEffect(() => {
    if (!selectedTransaction) {
      return
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      setSelectedTransaction(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [selectedTransaction])

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap">
          <div className="col-span-1 space-y-1 sm:min-w-[180px] sm:flex-1">
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

          <div className="col-span-1 space-y-1 sm:min-w-[200px] sm:flex-1">
            <Label htmlFor="account">Conta</Label>
            <select
              id="account"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={
                isAccountParamAll
                  ? 'all'
                  : resolvedAccountId ?? primaryAccount?.id ?? ''
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
            <div className="col-span-2 grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap">
              <div className="col-span-1 space-y-1 sm:min-w-[160px] sm:flex-1">
                <Label htmlFor="startDate">Início</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={customStartDate || startDate}
                  inputMode={isMobile ? 'none' : undefined}
                  onChange={(event) =>
                    handleCustomDateChange('startDate', event.target.value)
                  }
                  onClick={handleMobileDateClick}
                  onKeyDown={handleMobileDateKeyDown}
                  onPaste={handleMobileDatePaste}
                />
              </div>
              <div className="col-span-1 space-y-1 sm:min-w-[160px] sm:flex-1">
                <Label htmlFor="endDate">Fim</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={customEndDate || endDate}
                  inputMode={isMobile ? 'none' : undefined}
                  onChange={(event) =>
                    handleCustomDateChange('endDate', event.target.value)
                  }
                  onClick={handleMobileDateClick}
                  onKeyDown={handleMobileDateKeyDown}
                  onPaste={handleMobileDatePaste}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {showSummarySkeleton ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`summary-skeleton-${index}`}
              className={`animate-pulse rounded-lg border bg-background p-4 ${index === 2 ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <div className="h-4 w-20 rounded bg-muted/60" />
              <div className="mt-3 h-7 w-28 rounded bg-muted/60" />
            </div>
          ))
        ) : (
          <>
            <div className="rounded-lg border bg-background p-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                Receitas
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">
                <span className="sensitive">
                  {summary ? formatCurrencyValue(summary.income) : '--'}
                </span>
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowDownRight className="h-4 w-4 text-rose-500" />
                Despesas
              </p>
              <p className="mt-2 text-2xl font-semibold text-rose-600">
                <span className="sensitive">
                  {summary ? formatCurrencyValue(summary.expense) : '--'}
                </span>
              </p>
            </div>
            <div className="col-span-2 rounded-lg border bg-background p-4 sm:col-span-1">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Saldo
              </p>
              <p className="mt-2 text-2xl font-semibold">
                <span className="sensitive">
                  {summary ? formatCurrencyValue(summary.balance) : '--'}
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      {summaryError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
          {summaryError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <List className="h-6 w-6 text-muted-foreground" />
                    Últimas transações
                  </h2>
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
                {showTransactionsSkeleton &&
                  Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`transactions-skeleton-${index}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 animate-pulse"
                    >
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded bg-muted/60" />
                        <div className="h-3 w-24 rounded bg-muted/60" />
                      </div>
                      <div className="space-y-2 text-right">
                        <div className="h-4 w-20 rounded bg-muted/60" />
                        <div className="h-3 w-16 rounded bg-muted/60" />
                      </div>
                    </div>
                  ))}
                {transactionsError && (
                  <p className="text-sm text-destructive">
                    {transactionsError}
                  </p>
                )}
                {!showTransactionsSkeleton &&
                  !transactionsError &&
                  recentTransactions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma transação encontrada no período.
                    </p>
                  )}
                {!showTransactionsSkeleton &&
                  recentTransactions.map((transaction) => (
                    <button
                      key={transaction.id}
                      type="button"
                      className="flex w-full cursor-pointer flex-col gap-2 rounded-md border px-3 py-2 text-left text-sm transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                      onClick={() => setSelectedTransaction(transaction)}
                    >
                      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
                        <span className="font-medium">
                          {transaction.description || 'Sem descrição'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {transaction.subcategoryName ||
                            transaction.categoryName ||
                            'Sem categoria'}
                        </span>
                      </div>
                      <div className="flex w-full items-center justify-between gap-3 text-left sm:w-auto sm:justify-end sm:text-right">
                        <span
                          className={
                            transaction.type === 'income'
                              ? 'sensitive font-semibold text-emerald-600'
                              : 'sensitive font-semibold text-rose-600'
                          }
                        >
                          {transaction.type === 'income' ? '+' : '-'}{' '}
                          {formatCurrencyValue(transaction.amount)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateDisplay(transaction.date, dateFormatter)}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setIsTopExpensesOpen((prev) => !prev)}
                  aria-label={
                    isTopExpensesOpen
                      ? 'Recolher top despesas'
                      : 'Expandir top despesas'
                  }
                >
                  {isTopExpensesOpen ? '-' : '+'}
                </Button>
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <ArrowDownRight className="h-6 w-6 text-rose-500" />
                    Top 5 Despesas
                  </h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isTopExpensesOpen && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border sm:h-4 sm:w-4"
                      checked={expenseGroupBy === 'subcategory'}
                      onChange={(event) =>
                        setExpenseGroupBy(
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

            {isTopExpensesOpen && (
              <div className="mt-4 space-y-3">
                {showTopExpensesSkeleton &&
                  Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`top-expenses-skeleton-${index}`}
                      className="space-y-2 animate-pulse"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="h-4 w-32 rounded bg-muted/60" />
                          <div className="h-3 w-20 rounded bg-muted/60" />
                        </div>
                        <div className="space-y-2 text-right">
                          <div className="h-4 w-20 rounded bg-muted/60" />
                          <div className="h-3 w-12 rounded bg-muted/60" />
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/60" />
                    </div>
                  ))}
                {topExpensesError && (
                  <p className="text-sm text-destructive">
                    {topExpensesError}
                  </p>
                )}
                {!showTopExpensesSkeleton &&
                  !topExpensesError &&
                  topExpenseItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum gasto encontrado no período.
                    </p>
                  )}
                {!showTopExpensesSkeleton &&
                  topExpenseItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full space-y-2 rounded-md border border-transparent p-2 text-left transition hover:border-muted hover:bg-muted/30"
                      onClick={() => {
                        const isFallbackCategory =
                          expenseGroupBy === 'subcategory' &&
                          item.categoryName &&
                          item.name === item.categoryName
                        setSelectedTopCategory({
                          id: item.id,
                          name: item.name,
                          groupBy: isFallbackCategory
                            ? 'category'
                            : expenseGroupBy,
                          type: 'expense',
                        })
                      }}
                    >
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
                          <p className="sensitive font-medium">
                            {formatCurrencyValue(item.totalAmount)}
                          </p>
                          <p className="sensitive text-xs text-muted-foreground">
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
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setIsTopIncomeOpen((prev) => !prev)}
                  aria-label={
                    isTopIncomeOpen
                      ? 'Recolher top receitas'
                      : 'Expandir top receitas'
                  }
                >
                  {isTopIncomeOpen ? '-' : '+'}
                </Button>
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <ArrowUpRight className="h-6 w-6 text-emerald-500" />
                    Top 5 Receitas
                  </h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isTopIncomeOpen && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border sm:h-4 sm:w-4"
                      checked={incomeGroupBy === 'subcategory'}
                      onChange={(event) =>
                        setIncomeGroupBy(
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

            {isTopIncomeOpen && (
              <div className="mt-4 space-y-3">
                {showTopIncomeSkeleton &&
                  Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`top-income-skeleton-${index}`}
                      className="space-y-2 animate-pulse"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="h-4 w-32 rounded bg-muted/60" />
                          <div className="h-3 w-20 rounded bg-muted/60" />
                        </div>
                        <div className="space-y-2 text-right">
                          <div className="h-4 w-20 rounded bg-muted/60" />
                          <div className="h-3 w-12 rounded bg-muted/60" />
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/60" />
                    </div>
                  ))}
                {topIncomeError && (
                  <p className="text-sm text-destructive">
                    {topIncomeError}
                  </p>
                )}
                {!showTopIncomeSkeleton &&
                  !topIncomeError &&
                  topIncomeItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma receita encontrada no período.
                    </p>
                  )}
                {!showTopIncomeSkeleton &&
                  topIncomeItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full space-y-2 rounded-md border border-transparent p-2 text-left transition hover:border-muted hover:bg-muted/30"
                      onClick={() => {
                        const isFallbackCategory =
                          incomeGroupBy === 'subcategory' &&
                          item.categoryName &&
                          item.name === item.categoryName
                        setSelectedTopCategory({
                          id: item.id,
                          name: item.name,
                          groupBy: isFallbackCategory
                            ? 'category'
                            : incomeGroupBy,
                          type: 'income',
                        })
                      }}
                    >
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
                          <p className="sensitive font-medium">
                            {formatCurrencyValue(item.totalAmount)}
                          </p>
                          <p className="sensitive text-xs text-muted-foreground">
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
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Banknote className="h-6 w-6 text-muted-foreground" />
              Contas
            </h2>
            <p
              className={
                showAccountsSkeleton
                  ? 'text-base font-semibold text-muted-foreground text-right'
                  : totalAccountsBalance < 0
                    ? 'sensitive text-base font-semibold text-rose-600 text-right pr-3'
                    : totalAccountsBalance > 0
                      ? 'sensitive text-base font-semibold text-emerald-600 text-right pr-3'
                      : 'sensitive text-base font-semibold text-muted-foreground text-right pr-3'
              }
            >
              {showAccountsSkeleton
                ? '--'
                : formatCurrencyValue(totalAccountsBalance)}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {showAccountsSkeleton &&
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`accounts-skeleton-${index}`}
                  className="flex items-center justify-between rounded-md border p-3 animate-pulse"
                >
                  <div className="space-y-2">
                    <div className="h-4 w-28 rounded bg-muted/60" />
                    <div className="h-3 w-20 rounded bg-muted/60" />
                  </div>
                  <div className="h-4 w-16 rounded bg-muted/60" />
                </div>
              ))}
            {accountsQuery.isError && (
              <p className="text-sm text-destructive">
                {getApiErrorMessage(accountsQuery.error)}
              </p>
            )}
            {!showAccountsSkeleton &&
              !accountsQuery.isError &&
              visibleAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta cadastrada.
                </p>
              )}
            {!showAccountsSkeleton &&
              visibleAccounts.map((account) => {
                const isSelected = account.id === effectiveAccountId
                const displayBalance = account.currentBalance ?? 0

                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleAccountChange(account.id)}
                    className={
                      isSelected
                        ? 'flex w-full cursor-pointer items-center justify-between rounded-md border border-primary/60 bg-primary/5 p-3 text-left'
                        : 'flex w-full cursor-pointer items-center justify-between rounded-md border p-3 text-left hover:bg-muted/40'
                    }
                    aria-pressed={isSelected}
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
                    <p
                      className={
                        displayBalance < 0
                          ? 'sensitive font-semibold text-rose-600'
                          : displayBalance > 0
                            ? 'sensitive font-semibold text-emerald-600'
                            : 'sensitive font-semibold text-muted-foreground'
                      }
                    >
                      {formatCurrencyValue(displayBalance)}
                    </p>
                  </button>
                )
              })}
          </div>
        </div>
      </div>

      {selectedTopCategory && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setSelectedTopCategory(null)}
          />
          <div className="relative w-full max-w-2xl rounded-lg border bg-background p-4 shadow-lg sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Últimos lançamentos
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTopCategory.name}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="self-start">
                <Link
                  to="/app/transactions"
                  search={{
                    page: 1,
                    accountId: isAccountParamAll ? undefined : resolvedAccountId,
                    startDate,
                    endDate,
                    categoryId:
                      selectedTopCategory.groupBy === 'category'
                        ? selectedTopCategory.id
                        : undefined,
                    subcategoryId:
                      selectedTopCategory.groupBy === 'subcategory'
                        ? selectedTopCategory.id
                        : undefined,
                    type: selectedTopCategory.type,
                  }}
                >
                  Ver todas
                </Link>
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {topCategoryTransactionsQuery.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Carregando lançamentos...
                </p>
              )}
              {topCategoryTransactionsQuery.isError && (
                <p className="text-sm text-destructive">
                  {getApiErrorMessage(topCategoryTransactionsQuery.error)}
                </p>
              )}
              {!topCategoryTransactionsQuery.isLoading &&
                !topCategoryTransactionsQuery.isError &&
                (topCategoryTransactionsQuery.data?.data ?? []).length ===
                0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma transação encontrada no período.
                  </p>
                )}
              {!topCategoryTransactionsQuery.isLoading &&
                !topCategoryTransactionsQuery.isError &&
                (topCategoryTransactionsQuery.data?.data ?? []).map(
                  (transaction) => (
                    <button
                      key={transaction.id}
                      type="button"
                      className="flex w-full flex-col gap-2 rounded-md border px-3 py-2 text-left text-sm transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                      onClick={() => setSelectedTransaction(transaction)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {transaction.description || 'Sem descrição'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-left sm:text-right">
                        <span
                          className={
                            transaction.type === 'income'
                              ? 'sensitive font-semibold text-emerald-600'
                              : 'sensitive font-semibold text-rose-600'
                          }
                        >
                          {transaction.type === 'income' ? '+' : '-'}{' '}
                          {formatCurrencyValue(transaction.amount)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateDisplay(transaction.date, dateFormatter)}
                        </span>
                      </div>
                    </button>
                  ),
                )}
            </div>
          </div>
        </div>
      )}

      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setSelectedTransaction(null)}
          />
          <div
            className="relative w-full max-w-lg rounded-lg border bg-background p-4 shadow-lg sm:p-6"
            ref={detailModalRef}
            tabIndex={-1}
          >
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Detalhes da transação</h3>
              <p className="text-sm text-muted-foreground">
                Informações da transação selecionada.
              </p>
            </div>

            <div className="mt-6 grid gap-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">
                  {formatDateDisplay(selectedTransaction.date, dateFormatter)}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Descrição</span>
                <span className="relative">
                  <button
                    type="button"
                    className="cursor-pointer font-medium hover:underline"
                    onClick={() =>
                      handleCopyDetail(
                        selectedTransaction.description || 'Sem descrição',
                        'description',
                      )
                    }
                  >
                    {selectedTransaction.description || 'Sem descrição'}
                  </button>
                  {detailCopiedField === 'description' && (
                    <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                      Copiado!
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Conta</span>
                <span className="font-medium">
                  {selectedTransaction.accountName ||
                    accountMap.get(selectedTransaction.accountId) ||
                    '-'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Categoria</span>
                <span className="font-medium">
                  {selectedTransaction.categoryName || '-'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Subcategoria</span>
                <span className="font-medium">
                  {selectedTransaction.subcategoryId
                    ? selectedTransaction.subcategoryName || '-'
                    : '-'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">
                  {selectedTransaction.type === 'income'
                    ? 'Receita'
                    : 'Despesa'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Valor</span>
                <span className="relative">
                  <button
                    type="button"
                    className="sensitive cursor-pointer font-semibold hover:underline"
                    onClick={() =>
                      handleCopyDetail(
                        formatCurrencyValue(selectedTransaction.amount),
                        'amount',
                      )
                    }
                  >
                    {formatCurrencyValue(selectedTransaction.amount)}
                  </button>
                  {detailCopiedField === 'amount' && (
                    <span className="absolute -top-6 right-0 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
                      Copiado!
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Notas</span>
                <span className="font-medium">
                  {selectedTransaction.notes || 'Sem notas'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Criada em</span>
                <span className="font-medium">
                  {formatDateDisplay(
                    selectedTransaction.createdAt,
                    dateFormatter,
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
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

function formatDateDisplay(
  value: string | Date | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!value) {
    return '-'
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return formatter.format(date)
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
