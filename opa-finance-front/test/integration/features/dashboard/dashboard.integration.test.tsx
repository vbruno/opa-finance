import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Account } from '@/features/accounts'
import { logout, setAuth, type User } from '@/features/auth'
import type {
  TopCategory,
  Transaction,
  TransactionsListResponse,
  TransactionsSummary,
} from '@/features/transactions'
import {
  fireEvent,
  renderRouteWithProviders,
  screen,
  waitFor,
} from '../../../setup/render'
import { ok, server } from '../../../setup/msw'

const testUser: User = {
  id: 'user-1',
  name: 'Usuário Teste',
  email: 'teste@opafinance.fake',
  createdAt: '2026-05-16T00:00:00.000Z',
}

const accountsMock: Account[] = [
  {
    id: 'acc-1',
    name: 'Conta Principal',
    type: 'checking_account',
    currentBalance: 1250.75,
    isPrimary: true,
    isHiddenOnDashboard: false,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'acc-2',
    name: 'Conta Reserva',
    type: 'savings_account',
    currentBalance: 500,
    isPrimary: false,
    isHiddenOnDashboard: false,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'acc-3',
    name: 'Conta Oculta',
    type: 'cash',
    currentBalance: 999,
    isPrimary: false,
    isHiddenOnDashboard: true,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
]

const recentTransactionsMock: Transaction[] = [
  {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    accountName: 'Conta Principal',
    categoryId: 'cat-expense-1',
    categoryName: 'Alimentação',
    subcategoryId: null,
    subcategoryName: null,
    type: 'expense',
    amount: 120.5,
    date: '2026-05-10',
    description: 'Compra mercado',
    notes: 'Teste de integração',
    transferId: null,
    createdAt: '2026-05-10T10:00:00.000Z',
  },
]

const transactionsSummaryMock: TransactionsSummary = {
  income: 2400,
  expense: 1150.25,
  balance: 1249.75,
}

const topExpensesMock: TopCategory[] = [
  {
    id: 'cat-expense-1',
    name: 'Alimentação',
    totalAmount: 620.4,
    percentage: 54.1,
  },
]

const topIncomeMock: TopCategory[] = [
  {
    id: 'cat-income-1',
    name: 'Salário',
    totalAmount: 2400,
    percentage: 100,
  },
]

const topCategoryTransactionsMock: Transaction[] = [
  {
    id: 'tx-2',
    userId: 'user-1',
    accountId: 'acc-1',
    accountName: 'Conta Principal',
    categoryId: 'cat-expense-1',
    categoryName: 'Alimentação',
    subcategoryId: null,
    subcategoryName: null,
    type: 'expense',
    amount: 74.9,
    date: '2026-05-08',
    description: 'Supermercado',
    notes: null,
    transferId: null,
    createdAt: '2026-05-08T12:00:00.000Z',
  },
]

type QueryRecord = Record<string, string>

type DashboardRequestLogs = {
  summary: QueryRecord[]
  transactions: QueryRecord[]
  topCategories: QueryRecord[]
}

function toDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCurrentMonthRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0)

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  }
}

function getCurrentYearRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), 0, 1)
  const end = new Date(reference.getFullYear(), 11, 31)

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  }
}

function readQueryParams(url: URL) {
  const params: QueryRecord = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return params
}

function latest<T>(items: T[]) {
  return items[items.length - 1]
}

function createDashboardServerMocks({
  summaryResponse = transactionsSummaryMock,
  recentTransactionsResponse = recentTransactionsMock,
  topExpensesResponse = topExpensesMock,
  topIncomeResponse = topIncomeMock,
  topCategoryTransactionsResponse = topCategoryTransactionsMock,
  summaryErrorMessage,
  topExpensesErrorMessage,
  topIncomeErrorMessage,
}: {
  summaryResponse?: TransactionsSummary
  recentTransactionsResponse?: Transaction[]
  topExpensesResponse?: TopCategory[]
  topIncomeResponse?: TopCategory[]
  topCategoryTransactionsResponse?: Transaction[]
  summaryErrorMessage?: string
  topExpensesErrorMessage?: string
  topIncomeErrorMessage?: string
} = {}) {
  const requestLogs: DashboardRequestLogs = {
    summary: [],
    transactions: [],
    topCategories: [],
  }

  server.use(
    http.get('*/version', () =>
      ok({
        version: '1.2.0',
        commit: 'abc123',
        buildTime: '2026-05-16T00:00:00.000Z',
      }),
    ),
    http.get('*/accounts', () => ok(accountsMock)),
    http.get('*/transactions/summary', ({ request }) => {
      requestLogs.summary.push(readQueryParams(new URL(request.url)))
      if (summaryErrorMessage) {
        return ok({ detail: summaryErrorMessage }, { status: 500 })
      }
      return ok(summaryResponse)
    }),
    http.get('*/transactions/top-categories', ({ request }) => {
      const params = readQueryParams(new URL(request.url))
      requestLogs.topCategories.push(params)

      if (params.type === 'expense' && topExpensesErrorMessage) {
        return ok({ detail: topExpensesErrorMessage }, { status: 500 })
      }

      if (params.type === 'income' && topIncomeErrorMessage) {
        return ok({ detail: topIncomeErrorMessage }, { status: 500 })
      }

      if (params.type === 'income') {
        return ok(topIncomeResponse)
      }

      return ok(topExpensesResponse)
    }),
    http.get('*/transactions', ({ request }) => {
      const params = readQueryParams(new URL(request.url))
      requestLogs.transactions.push(params)

      if (params.categoryId === 'cat-expense-1') {
        return ok({
          data: topCategoryTransactionsResponse,
          page: 1,
          limit: 5,
          total: topCategoryTransactionsResponse.length,
        } satisfies TransactionsListResponse)
      }

      return ok({
        data: recentTransactionsResponse,
        page: 1,
        limit: 5,
        total: recentTransactionsResponse.length,
      } satisfies TransactionsListResponse)
    }),
  )

  return requestLogs
}

describe('dashboard integration', () => {
  beforeEach(() => {
    localStorage.clear()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve renderizar o dashboard e suportar expansão, recolhimento e modais', async () => {
    const requestLogs = createDashboardServerMocks()

    renderRouteWithProviders({ initialEntries: ['/app'] })

    await screen.findByRole('heading', { name: 'Dashboard' })
    await waitFor(() => {
      expect(screen.getByLabelText('Conta')).toHaveValue('acc-1')
    })

    expect(screen.getByRole('heading', { name: 'Últimas transações' })).toBeInTheDocument()
    expect(screen.getByText('Receitas')).toBeInTheDocument()
    expect(screen.getByText('Despesas')).toBeInTheDocument()
    expect(screen.getByText('Saldo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Conta Principal/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByRole('option', { name: 'Conta Oculta' })).not.toBeInTheDocument()

    const recentTransactionButton = screen.getByRole('button', {
      name: /Compra mercado/,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Recolher transações' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Compra mercado/ })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Expandir transações' }))
    expect(await screen.findByRole('button', { name: /Compra mercado/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Top 5 Despesas' }))
    const expenseItemButton = screen.getAllByRole('button').find((button) => {
      const text = button.textContent ?? ''
      return text.includes('Alimentação') && text.includes('54.1%')
    })
    expect(expenseItemButton).toBeDefined()

    fireEvent.click(expenseItemButton as HTMLButtonElement)
    await waitFor(() => {
      expect(latest(requestLogs.transactions)).toMatchObject({
        accountId: 'acc-1',
        categoryId: 'cat-expense-1',
        dir: 'desc',
        excludeHiddenAccounts: 'true',
        limit: '5',
        page: '1',
        sort: 'date',
        startDate: getCurrentMonthRange().startDate,
        endDate: getCurrentMonthRange().endDate,
        type: 'expense',
      })
    })
    expect(
      await screen.findByRole('heading', { name: 'Últimos lançamentos' }),
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Últimos lançamentos' }),
      ).not.toBeInTheDocument()
    })

    const reopenedRecentTransactionButton = screen.getByRole('button', {
      name: /Compra mercado/,
    })
    fireEvent.click(reopenedRecentTransactionButton)
    const transactionModalHeading = await screen.findByRole('heading', {
      name: 'Detalhes da transação',
    })
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(transactionModalHeading).not.toBeInTheDocument()
    })
  })

  it('deve atualizar filtros na URL e nos contratos do dashboard', async () => {
    const requestLogs = createDashboardServerMocks()
    const currentYearRange = getCurrentYearRange(new Date('2026-05-17T10:00:00Z'))

    const { router } = renderRouteWithProviders({ initialEntries: ['/app'] })

    await screen.findByRole('heading', { name: 'Dashboard' })
    await waitFor(() => {
      expect(screen.getByLabelText('Conta')).toHaveValue('acc-1')
    })

    fireEvent.change(screen.getByLabelText('Período'), {
      target: { value: 'currentYear' },
    })

    await waitFor(() => {
      expect(router.state.location.search.period).toBe('currentYear')
    })
    await waitFor(() => {
      expect(latest(requestLogs.summary)).toMatchObject({
        accountId: 'acc-1',
        excludeHiddenAccounts: 'true',
        startDate: currentYearRange.startDate,
        endDate: currentYearRange.endDate,
      })
    })

    expect(screen.getByLabelText('Período')).toHaveValue('currentYear')

    fireEvent.change(screen.getByLabelText('Conta'), {
      target: { value: 'all' },
    })

    await waitFor(() => {
      expect(router.state.location.search.accountId).toBe('all')
    })
    await waitFor(() => {
      expect(latest(requestLogs.summary)).toMatchObject({
        excludeHiddenAccounts: 'true',
        startDate: currentYearRange.startDate,
        endDate: currentYearRange.endDate,
      })
      expect(latest(requestLogs.transactions)).toMatchObject({
        excludeHiddenAccounts: 'true',
        startDate: currentYearRange.startDate,
        endDate: currentYearRange.endDate,
      })
      expect(latest(requestLogs.topCategories)).toMatchObject({
        excludeHiddenAccounts: 'true',
        startDate: currentYearRange.startDate,
        endDate: currentYearRange.endDate,
      })
    })

    expect(latest(requestLogs.summary).accountId).toBeUndefined()
    expect(latest(requestLogs.transactions).accountId).toBeUndefined()
    expect(latest(requestLogs.topCategories).accountId).toBeUndefined()

    expect(screen.getByLabelText('Conta')).toHaveValue('all')
  })

  it('deve mostrar estados vazios nas listas e cards do dashboard', async () => {
    createDashboardServerMocks({
      recentTransactionsResponse: [],
      topExpensesResponse: [],
      topIncomeResponse: [],
      summaryResponse: {
        income: 0,
        expense: 0,
        balance: 0,
      },
    })

    renderRouteWithProviders({ initialEntries: ['/app'] })

    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(
      await screen.findByText('Nenhuma transação encontrada no período.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Top 5 Despesas' }))
    expect(await screen.findByText('Nenhum gasto encontrado no período.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Top 5 Receitas' }))
    expect(await screen.findByText('Nenhuma receita encontrada no período.')).toBeInTheDocument()
  })

  it('deve exibir erros sem quebrar a tela principal', async () => {
    createDashboardServerMocks({
      summaryErrorMessage: 'Resumo do dashboard indisponível.',
      topExpensesErrorMessage: 'Resumo de despesas indisponível.',
    })

    renderRouteWithProviders({ initialEntries: ['/app'] })

    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(
      await screen.findByText('Resumo do dashboard indisponível.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Receitas')).toBeInTheDocument()
    expect(screen.getByText('Despesas')).toBeInTheDocument()
    expect(screen.getByText('Saldo')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Top 5 Despesas' }))
    expect(await screen.findByText('Resumo de despesas indisponível.')).toBeInTheDocument()
  })
})
