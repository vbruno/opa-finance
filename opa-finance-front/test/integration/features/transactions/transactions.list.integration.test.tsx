import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { logout, setAuth, type User } from '@/features/auth'
import type { Account } from '@/features/accounts'
import type { Category } from '@/features/categories'
import type { Transaction, TransactionsListResponse } from '@/features/transactions'
import { renderRouteWithProviders, screen } from '../../../setup/render'
import { ok, server } from '../../../setup/msw'

const testUser: User = {
  id: 'user-1',
  name: 'Usuário Teste',
  email: 'teste@opafinance.fake',
  createdAt: '2026-04-12T00:00:00.000Z',
}

const accountsMock: Account[] = [
  {
    id: 'acc-1',
    name: 'CommBank ACC',
    type: 'checking',
    currentBalance: 1000,
    isPrimary: true,
    isHiddenOnDashboard: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

const categoriesMock: Category[] = [
  {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Habitação',
    description: null,
    type: 'expense',
    system: false,
    color: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

const transactionsMock: Transaction[] = [
  {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    accountName: 'CommBank ACC',
    categoryId: 'cat-1',
    categoryName: 'Habitação',
    subcategoryId: null,
    subcategoryName: null,
    type: 'expense',
    amount: 265,
    date: '2026-03-01',
    description: 'Aluguel',
    notes: null,
    transferId: null,
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'tx-2',
    userId: 'user-1',
    accountId: 'acc-1',
    accountName: 'CommBank ACC',
    categoryId: 'cat-1',
    categoryName: 'Habitação',
    subcategoryId: null,
    subcategoryName: null,
    type: 'expense',
    amount: 81.53,
    date: '2026-03-02',
    description: 'Eating Out',
    notes: 'Notas de teste',
    transferId: null,
    createdAt: '2026-03-02T00:00:00.000Z',
  },
]

const transactionsResponse: TransactionsListResponse = {
  data: transactionsMock,
  page: 1,
  limit: 30,
  total: transactionsMock.length,
}

describe('transactions list component', () => {
  beforeEach(() => {
    localStorage.clear()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve renderizar tabela/listagem com dados mockados da API', async () => {
    let transactionsHits = 0

    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-12T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/transactions', () => {
        transactionsHits += 1
        return ok(transactionsResponse)
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/transactions'] })

    await screen.findByRole('heading', { name: 'Transações' })

    const aluguelItems = await screen.findAllByText('Aluguel')
    const eatingOutItems = await screen.findAllByText('Eating Out')

    expect(transactionsHits).toBeGreaterThan(0)
    expect(aluguelItems.length).toBeGreaterThan(0)
    expect(eatingOutItems.length).toBeGreaterThan(0)
    expect(screen.getAllByText('CommBank ACC').length).toBeGreaterThan(0)
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument()
  })
})
