import { fireEvent } from '@testing-library/react'
import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { logout, setAuth, type User } from '@/features/auth'
import type { Account } from '@/features/accounts'
import type { Category, Subcategory } from '@/features/categories'
import type {
  Transaction,
  TransactionCreatePayload,
  TransactionUpdatePayload,
} from '@/features/transactions'
import {
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

const subcategoriesMock: Subcategory[] = [
  {
    id: 'sub-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    name: 'Aluguel',
    description: null,
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

describe('transactions create/edit flow', () => {
  beforeEach(() => {
    localStorage.clear()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve criar e editar transação com API interceptada', async () => {
    let transactionsState: Transaction[] = [
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
        description: 'Base aluguel',
        notes: null,
        transferId: null,
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ]

    let createdTransactionId = ''
    let createPayloadCaptured: TransactionCreatePayload | null = null
    let updatePayloadCaptured: TransactionUpdatePayload | null = null

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
      http.get('*/categories/:categoryId/subcategories', ({ params }) => {
        if (params.categoryId === 'cat-1') {
          return ok(subcategoriesMock)
        }
        return ok([])
      }),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.get('*/transactions/summary', () =>
        ok({
          income: 0,
          expense: 265,
          balance: -265,
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
      http.post('*/transactions', async ({ request }) => {
        const payload = (await request.json()) as TransactionCreatePayload
        createPayloadCaptured = payload
        createdTransactionId = 'tx-created'

        const created: Transaction = {
          id: createdTransactionId,
          userId: 'user-1',
          accountId: payload.accountId,
          accountName: 'CommBank ACC',
          categoryId: payload.categoryId,
          categoryName: 'Habitação',
          subcategoryId: payload.subcategoryId ?? null,
          subcategoryName:
            payload.subcategoryId === 'sub-1' ? 'Aluguel' : null,
          type: payload.type,
          amount: payload.amount,
          date: payload.date,
          description: payload.description ?? null,
          notes: payload.notes ?? null,
          transferId: null,
          createdAt: '2026-03-03T00:00:00.000Z',
        }

        transactionsState = [created, ...transactionsState]
        return ok(created, { status: 201 })
      }),
      http.put('*/transactions/:id', async ({ params, request }) => {
        const payload = (await request.json()) as TransactionUpdatePayload
        updatePayloadCaptured = payload
        const targetId = String(params.id)

        transactionsState = transactionsState.map((item) =>
          item.id === targetId
            ? {
                ...item,
                ...payload,
                description: payload.description ?? item.description,
                notes: payload.notes ?? item.notes,
                subcategoryId:
                  payload.subcategoryId === undefined
                    ? item.subcategoryId
                    : payload.subcategoryId,
                subcategoryName:
                  payload.subcategoryId === 'sub-1'
                    ? 'Aluguel'
                    : payload.subcategoryId === null
                      ? null
                      : item.subcategoryName,
              }
            : item,
        )

        const updated = transactionsState.find((item) => item.id === targetId)
        if (!updated) {
          throw new Error(`Transação ${targetId} não encontrada no mock.`)
        }
        return ok(updated)
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/transactions'] })

    await screen.findByRole('heading', { name: 'Transações' })
    await screen.findAllByText('Base aluguel')

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    fireEvent.click(screen.getByRole('button', { name: /Transação/i }))
    await screen.findByRole('heading', { name: 'Nova transação' })

    const categorySelect = getElementByIdOrThrow<HTMLButtonElement>(
      'transaction-category',
    )
    fireEvent.click(categorySelect)

    fireEvent.click(
      await screen.findByRole('option', { name: /^Habitação$/i }),
    )

    const amountInput = getElementByIdOrThrow<HTMLInputElement>(
      'transaction-amount',
    )
    fireEvent.change(amountInput, { target: { value: '123,45' } })
    fireEvent.blur(amountInput)

    const createDescriptionInput = getElementByIdOrThrow<HTMLInputElement>(
      'transaction-description',
    )
    fireEvent.change(createDescriptionInput, {
      target: { value: 'Fluxo create teste' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', { name: 'Nova transação' }),
    )

    expect(createPayloadCaptured).toMatchObject({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: 'expense',
      amount: 123.45,
      description: 'Fluxo create teste',
    })
    expect(createdTransactionId).toBeTruthy()

    await screen.findAllByText('Fluxo create teste')

    fireEvent.click(screen.getAllByText('Fluxo create teste')[0]!)
    await screen.findByRole('heading', { name: 'Detalhes da transação' })

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findByRole('heading', { name: 'Editar transação' })

    const editDescriptionInput = getElementByIdOrThrow<HTMLInputElement>(
      'transaction-edit-description',
    )
    fireEvent.change(editDescriptionInput, {
      target: { value: 'Fluxo edit teste' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await screen.findAllByText('Fluxo edit teste')

    expect(updatePayloadCaptured).toMatchObject({
      description: 'Fluxo edit teste',
    })
  })
})
