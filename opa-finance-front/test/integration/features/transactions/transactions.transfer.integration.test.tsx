import { fireEvent } from '@testing-library/react'
import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Account } from '@/features/accounts'
import { logout, setAuth, type User } from '@/features/auth'
import type { Category } from '@/features/categories'
import type { Transaction, TransactionUpdatePayload } from '@/features/transactions'
import type { TransferCreatePayload } from '@/features/transfers'
import {
  waitFor,
  renderRouteWithProviders,
  screen,
  waitForElementToBeRemoved,
} from '../../../setup/render'
import { ok, parsePaginationFromUrl, server } from '../../../setup/msw'

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
  {
    id: 'acc-2',
    name: 'Wise AUD',
    type: 'checking',
    currentBalance: 500,
    isPrimary: false,
    isHiddenOnDashboard: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

const categoriesMock: Category[] = [
  {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Transferência',
    description: null,
    type: 'expense',
    system: false,
    color: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

function getElementByIdOrThrow<TElement extends HTMLElement>(id: string) {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error(`Elemento com id "${id}" não encontrado.`)
  }
  return element as TElement
}

describe('transactions transfer flow', () => {
  beforeEach(() => {
    localStorage.clear()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve criar e editar transferência com API interceptada', async () => {
    const transactionsState: Transaction[] = [
      {
        id: 'tx-exp',
        userId: 'user-1',
        accountId: 'acc-1',
        accountName: 'CommBank ACC',
        categoryId: 'cat-1',
        categoryName: 'Transferência',
        subcategoryId: null,
        subcategoryName: null,
        type: 'expense',
        amount: 80,
        date: '2026-03-01',
        description: 'Transfer base',
        notes: null,
        transferId: 'tr-1',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'tx-inc',
        userId: 'user-1',
        accountId: 'acc-2',
        accountName: 'Wise AUD',
        categoryId: 'cat-1',
        categoryName: 'Transferência',
        subcategoryId: null,
        subcategoryName: null,
        type: 'income',
        amount: 80,
        date: '2026-03-01',
        description: 'Transfer base',
        notes: null,
        transferId: 'tr-1',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ]

    let transferCreatePayload: TransferCreatePayload | null = null
    let recurrenceCreatePayload: Record<string, unknown> | null = null
    const transactionUpdateCalls: Array<{
      id: string
      payload: TransactionUpdatePayload
    }> = []

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
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.get('*/transactions/summary', () =>
        ok({
          income: 80,
          expense: 80,
          balance: 0,
        }),
      ),
      http.get('*/transactions/top-categories', () => ok([])),
      http.get('*/transactions', ({ request }) => {
        const { page, limit } = parsePaginationFromUrl(request.url)
        const total = transactionsState.length
        const start = (page - 1) * limit
        const end = start + limit
        return ok({
          data: transactionsState.slice(start, end),
          page,
          limit,
          total,
        })
      }),
      http.post('*/transfers', async ({ request }) => {
        transferCreatePayload = (await request.json()) as TransferCreatePayload
        return ok(
          {
            id: 'tr-created',
            fromAccount: { id: 'tx-new-exp', accountId: 'acc-1' },
            toAccount: { id: 'tx-new-inc', accountId: 'acc-2' },
          },
          { status: 201 },
        )
      }),
      http.post('*/recurrences', async ({ request }) => {
        recurrenceCreatePayload = (await request.json()) as Record<
          string,
          unknown
        >
        return ok({ id: 'rec-1' }, { status: 201 })
      }),
      http.put('*/transactions/:id', async ({ params, request }) => {
        const payload = (await request.json()) as TransactionUpdatePayload
        transactionUpdateCalls.push({ id: String(params.id), payload })
        return ok({
          id: String(params.id),
          ...payload,
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/transactions'] })

    await screen.findByRole('heading', { name: 'Transações' })
    await screen.findAllByText('Transfer base')

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    fireEvent.click(screen.getByRole('button', { name: /Transferência/i }))

    await screen.findByRole('heading', { name: 'Nova transferência' })
    const amountInput = getElementByIdOrThrow<HTMLInputElement>('transfer-amount')
    fireEvent.change(amountInput, { target: { value: '123,45' } })
    const descriptionInput =
      getElementByIdOrThrow<HTMLInputElement>('transfer-description')
    fireEvent.change(descriptionInput, { target: { value: 'Transfer teste' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tornar recorrente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }))

    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', { name: 'Nova transferência' }),
    )

    expect(transferCreatePayload).toMatchObject({
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amount: 123.45,
      description: 'Transfer teste',
      recurrence: {
        originType: 'transfer',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-2',
        frequency: 'monthly',
      },
    })
    expect(recurrenceCreatePayload).toBeNull()

    fireEvent.click(screen.getAllByText('Transfer base')[0]!)
    await screen.findByRole('heading', { name: 'Detalhes da transação' })
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findByRole('heading', { name: 'Editar transferência' })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', { name: 'Editar transferência' }),
    )

    expect(transactionUpdateCalls).toHaveLength(2)
    expect(transactionUpdateCalls.map((call) => call.id).sort()).toEqual([
      'tx-exp',
      'tx-inc',
    ])
  })

  it('deve bloquear submissão quando origem e destino são a mesma conta', async () => {
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
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.get('*/transactions/summary', () =>
        ok({
          income: 0,
          expense: 0,
          balance: 0,
        }),
      ),
      http.get('*/transactions/top-categories', () => ok([])),
      http.get('*/transactions', () =>
        ok({
          data: [],
          page: 1,
          limit: 30,
          total: 0,
        }),
      ),
    )

    renderRouteWithProviders({ initialEntries: ['/app/transactions'] })

    await screen.findByRole('heading', { name: 'Transações' })

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    fireEvent.click(screen.getByRole('button', { name: /Transferência/i }))
    await screen.findByRole('heading', { name: 'Nova transferência' })

    const toAccountSelect = getElementByIdOrThrow<HTMLButtonElement>(
      'transfer-to-account',
    )
    fireEvent.click(toAccountSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'CommBank ACC' }))

    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }))

    await waitFor(() => {
      expect(
        screen.getByText('As contas precisam ser diferentes.'),
      ).toBeInTheDocument()
    })
  })
})
