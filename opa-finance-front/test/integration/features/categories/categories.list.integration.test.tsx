import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logout, setAuth, type User } from '@/features/auth'
import type { Category, Subcategory } from '@/features/categories'
import { fireEvent, renderRouteWithProviders, screen, within } from '../../../setup/render'
import { ok, server } from '../../../setup/msw'

const testUser: User = {
  id: 'user-1',
  name: 'Usuário Teste',
  email: 'teste@opafinance.fake',
  createdAt: '2026-04-12T00:00:00.000Z',
}

const categoriesMock: Category[] = [
  {
    id: 'cat-income',
    userId: 'user-1',
    name: 'Salário',
    description: 'Renda mensal',
    type: 'income',
    system: false,
    color: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'cat-expense',
    userId: 'user-1',
    name: 'Mercado',
    description: 'Compras',
    type: 'expense',
    system: false,
    color: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

const subcategoriesByCategory: Record<string, Subcategory[]> = {
  'cat-income': [
    {
      id: 'sub-income-1',
      userId: 'user-1',
      categoryId: 'cat-income',
      name: 'Décimo terceiro',
      description: null,
      color: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
  ],
  'cat-expense': [
    {
      id: 'sub-expense-1',
      userId: 'user-1',
      categoryId: 'cat-expense',
      name: 'Supermercado',
      description: 'Compras da semana',
      color: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
  ],
}

describe('categories list component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve filtrar por tipo e expandir/recolher subcategorias', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-12T00:00:00.000Z',
        }),
      ),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', ({ params }) => {
        const categoryId = String(params.categoryId)
        return ok(subcategoriesByCategory[categoryId] ?? [])
      }),
      http.post('*/categories/bootstrap-defaults', () =>
        ok({
          message: 'ok',
          createdCategories: 0,
          createdSubcategories: 0,
        }),
      ),
    )

    renderRouteWithProviders({ initialEntries: ['/app/categories'] })

    await screen.findByRole('heading', { name: 'Categorias' })
    expect((await screen.findAllByText('Salário')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Mercado')).length).toBeGreaterThan(0)

    const select = screen.getAllByRole('combobox')[0]
    fireEvent.change(select, { target: { value: 'expense' } })

    expect((await screen.findAllByText('Mercado')).length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Salário')).toHaveLength(0)

    const mercadoRows = screen
      .getAllByText('Mercado')
      .map((node) => node.closest('tr'))
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
    expect(mercadoRows.length).toBeGreaterThan(0)
    const expandButton = within(mercadoRows[0]).getByRole('button', {
      name: 'Mostrar subcategorias',
    })

    fireEvent.click(expandButton)
    expect((await screen.findAllByText('Supermercado')).length).toBeGreaterThan(0)

    fireEvent.click(expandButton)
    expect(screen.queryAllByText('Supermercado')).toHaveLength(0)
  })
})
