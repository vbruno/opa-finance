import { fireEvent, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Account } from '@/features/accounts'
import { logout, setAuth, type User } from '@/features/auth'
import type { Category, Subcategory } from '@/features/categories'
import type { Transaction } from '@/features/transactions'
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
  createdAt: '2026-04-21T00:00:00.000Z',
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

function getElementByIdOrThrow<TElement extends HTMLElement>(id: string) {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error(`Elemento com id "${id}" não encontrado.`)
  }
  return element as TElement
}

describe('transactions delete and inline category flows', () => {
  beforeEach(() => {
    localStorage.clear()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve excluir transação individual e tratar falha parcial no delete em lote', async () => {
    const categories: Category[] = [
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
        amount: 100,
        date: '2026-03-01',
        description: 'Despesa A',
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
        amount: 80,
        date: '2026-03-02',
        description: 'Despesa B',
        notes: null,
        transferId: null,
        createdAt: '2026-03-02T00:00:00.000Z',
      },
      {
        id: 'tx-3',
        userId: 'user-1',
        accountId: 'acc-1',
        accountName: 'CommBank ACC',
        categoryId: 'cat-1',
        categoryName: 'Habitação',
        subcategoryId: null,
        subcategoryName: null,
        type: 'expense',
        amount: 60,
        date: '2026-03-03',
        description: 'Despesa C',
        notes: null,
        transferId: null,
        createdAt: '2026-03-03T00:00:00.000Z',
      },
    ]

    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-21T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categories)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.get('*/transactions/summary', () =>
        ok({
          income: 0,
          expense: 240,
          balance: -240,
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
      http.delete('*/transactions/:id', ({ params }) => {
        const targetId = String(params.id)
        if (targetId === 'tx-3') {
          return HttpResponse.json(
            { detail: 'Falha simulada no lote.' },
            { status: 500 },
          )
        }
        transactionsState = transactionsState.filter((tx) => tx.id !== targetId)
        return new HttpResponse(null, { status: 204 })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/transactions'] })

    await screen.findByRole('heading', { name: 'Transações' })
    await screen.findAllByText('Despesa A')

    fireEvent.click(screen.getAllByText('Despesa A')[0]!)
    await screen.findByRole('heading', { name: 'Detalhes da transação' })
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    await screen.findByRole('heading', { name: 'Confirmar exclusao' })
    const singleDeleteModal = screen
      .getByRole('heading', { name: 'Confirmar exclusao' })
      .closest('[tabindex="-1"]')
    if (!singleDeleteModal) {
      throw new Error('Modal de exclusão individual não encontrado.')
    }
    fireEvent.click(within(singleDeleteModal).getByRole('button', { name: /^Excluir$/ }))

    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', { name: 'Confirmar exclusao' }),
    )

    await waitFor(() => {
      expect(screen.queryByText('Despesa A')).not.toBeInTheDocument()
    })

    const checkboxes = screen.getAllByLabelText('Selecionar transação')
    fireEvent.click(checkboxes[0]!)
    fireEvent.click(checkboxes[1]!)

    fireEvent.click(screen.getAllByRole('button', { name: /^Excluir$/ })[0]!)
    await screen.findByRole('heading', { name: 'Confirmar exclusão' })
    const bulkDeleteModal = screen
      .getByRole('heading', { name: 'Confirmar exclusão' })
      .closest('[tabindex="-1"]')
    if (!bulkDeleteModal) {
      throw new Error('Modal de exclusão em lote não encontrado.')
    }
    fireEvent.click(within(bulkDeleteModal).getByRole('button', { name: /^Excluir$/ }))

    await screen.findByText('Erro ao excluir transações. Tente novamente.')
  })

  it('deve criar categoria e subcategoria inline no modal de nova transação', async () => {
    const categoriesState: Category[] = [
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

    const subcategoriesByCategory = new Map<string, Subcategory[]>([
      ['cat-1', []],
    ])

    let createdCategoryPayload: { name: string; type: string } | null = null
    let createdSubcategoryPayload: { categoryId: string; name: string } | null =
      null

    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-21T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesState)),
      http.get('*/categories/:categoryId/subcategories', ({ params }) => {
        return ok(subcategoriesByCategory.get(String(params.categoryId)) ?? [])
      }),
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
      http.post('*/categories', async ({ request }) => {
        const payload = (await request.json()) as { name: string; type: string }
        createdCategoryPayload = payload
        const created: Category = {
          id: 'cat-new',
          userId: 'user-1',
          name: payload.name,
          description: null,
          type: payload.type as 'income' | 'expense',
          system: false,
          color: null,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        }
        categoriesState.push(created)
        subcategoriesByCategory.set(created.id, [])
        return ok(created, { status: 201 })
      }),
      http.post('*/subcategories', async ({ request }) => {
        const payload = (await request.json()) as {
          categoryId: string
          name: string
        }
        createdSubcategoryPayload = payload
        const created: Subcategory = {
          id: 'sub-new',
          userId: 'user-1',
          categoryId: payload.categoryId,
          name: payload.name,
          description: null,
          color: null,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        }
        const current = subcategoriesByCategory.get(payload.categoryId) ?? []
        subcategoriesByCategory.set(payload.categoryId, [...current, created])
        return ok(created, { status: 201 })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/transactions'] })

    await screen.findByRole('heading', { name: 'Transações' })

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    fireEvent.click(screen.getByRole('button', { name: /Transação/i }))
    await screen.findByRole('heading', { name: 'Nova transação' })

    const categorySelect = getElementByIdOrThrow<HTMLButtonElement>(
      'transaction-category',
    )
    fireEvent.click(categorySelect)
    fireEvent.click(await screen.findByRole('option', { name: '+ Nova categoria' }))

    await screen.findByRole('heading', { name: 'Nova categoria' })
    fireEvent.change(
      getElementByIdOrThrow<HTMLSelectElement>('transaction-category-new-type'),
      { target: { value: 'expense' } },
    )
    fireEvent.change(
      getElementByIdOrThrow<HTMLInputElement>('transaction-category-new-name'),
      { target: { value: 'Recorrência Casa' } },
    )
    const createCategoryModal = screen
      .getByRole('heading', { name: 'Nova categoria' })
      .closest('.relative')
    if (!createCategoryModal) {
      throw new Error('Modal de criação de categoria não encontrado.')
    }
    fireEvent.click(within(createCategoryModal).getByRole('button', { name: 'Salvar' }))
    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', { name: 'Nova categoria' }),
    )

    expect(createdCategoryPayload).toEqual({
      name: 'Recorrência Casa',
      type: 'expense',
    })

    fireEvent.click(categorySelect)
    fireEvent.click(
      await screen.findByRole('option', { name: '+ Nova subcategoria' }),
    )

    await screen.findByRole('heading', { name: 'Nova subcategoria' })
    fireEvent.change(
      getElementByIdOrThrow<HTMLSelectElement>(
        'transaction-subcategory-new-category',
      ),
      { target: { value: 'cat-new' } },
    )
    fireEvent.change(
      getElementByIdOrThrow<HTMLInputElement>('transaction-subcategory-new-name'),
      { target: { value: 'Assinaturas Casa' } },
    )
    const createSubcategoryModal = screen
      .getByRole('heading', { name: 'Nova subcategoria' })
      .closest('.relative')
    if (!createSubcategoryModal) {
      throw new Error('Modal de criação de subcategoria não encontrado.')
    }
    fireEvent.click(within(createSubcategoryModal).getByRole('button', { name: 'Salvar' }))
    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', { name: 'Nova subcategoria' }),
    )

    expect(createdSubcategoryPayload).toEqual({
      categoryId: 'cat-new',
      name: 'Assinaturas Casa',
    })
  })
})
