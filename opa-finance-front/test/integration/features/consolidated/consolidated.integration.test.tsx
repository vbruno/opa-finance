import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { logout, setAuth, type User } from '@/features/auth'
import type { Account } from '@/features/accounts'
import type { ConsolidatedResponse, RecurrenceForecastResponse } from '@/features/reports'
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
  createdAt: '2026-04-17T00:00:00.000Z',
}

const accountsMock: Account[] = [
  {
    id: 'acc-1',
    name: 'Conta principal',
    type: 'checking',
    currentBalance: 1000,
    isPrimary: true,
    isHiddenOnDashboard: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'acc-2',
    name: 'Conta secundária',
    type: 'savings',
    currentBalance: 2000,
    isPrimary: false,
    isHiddenOnDashboard: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

const consolidatedMock: ConsolidatedResponse = {
  year: 2026,
  accountIds: ['acc-2'],
  income: [
    {
      categoryId: 'cat-inc',
      categoryName: 'Receitas Fixas',
      months: [1000, 1200, 1100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      yearTotal: 3300,
      subcategories: [
        {
          subcategoryId: 'sub-inc',
          subcategoryName: 'Salário',
          months: [1000, 1200, 1100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          yearTotal: 3300,
        },
      ],
    },
  ],
  expense: [
    {
      categoryId: 'cat-exp',
      categoryName: 'Habitação',
      months: [400, 450, 420, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      yearTotal: 1270,
      subcategories: [
        {
          subcategoryId: 'sub-exp',
          subcategoryName: 'Aluguel',
          months: [400, 450, 420, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          yearTotal: 1270,
        },
      ],
    },
  ],
  totals: {
    income: {
      months: [1000, 1200, 1100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      yearTotal: 3300,
    },
    expense: {
      months: [400, 450, 420, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      yearTotal: 1270,
    },
  },
}

const forecastMock: RecurrenceForecastResponse = {
  year: 2026,
  timezone: 'Australia/Adelaide',
  accountIds: ['acc-1'],
  horizon: {
    projectionStartDate: '2026-04-01',
    projectionEndDate: '2026-12-31',
  },
  totals: {
    real: {
      income: { months: [1000, 1200, 1100, 0, 0, 0, 0, 0, 0, 0, 0, 0], yearTotal: 3300 },
      expense: { months: [400, 450, 420, 0, 0, 0, 0, 0, 0, 0, 0, 0], yearTotal: 1270 },
      balance: { months: [600, 750, 680, 0, 0, 0, 0, 0, 0, 0, 0, 0], yearTotal: 2030 },
    },
    projected: {
      income: { months: [0, 0, 0, 900, 900, 900, 900, 900, 900, 900, 900, 900], yearTotal: 8100 },
      expense: { months: [0, 0, 0, 300, 300, 300, 300, 300, 300, 300, 300, 300], yearTotal: 2700 },
      balance: { months: [0, 0, 0, 600, 600, 600, 600, 600, 600, 600, 600, 600], yearTotal: 5400 },
    },
    combined: {
      income: { months: [1000, 1200, 1100, 900, 900, 900, 900, 900, 900, 900, 900, 900], yearTotal: 11400 },
      expense: { months: [400, 450, 420, 300, 300, 300, 300, 300, 300, 300, 300, 300], yearTotal: 3970 },
      balance: { months: [600, 750, 680, 600, 600, 600, 600, 600, 600, 600, 600, 600], yearTotal: 7430 },
    },
  },
  metadata: {
    projectedOccurrences: 10,
  },
}

function mockDesktopViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 960px'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

describe('consolidated feature', () => {
  beforeEach(() => {
    localStorage.clear()
    mockDesktopViewport()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve respeitar filtros da URL no carregamento inicial', async () => {
    let capturedSearch = ''

    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/reports/consolidated/years', () => ok({ years: [2026, 2025] })),
      http.get('*/reports/consolidated', ({ request }) => {
        capturedSearch = new URL(request.url).search
        return ok(consolidatedMock)
      }),
    )

    renderRouteWithProviders({
      initialEntries: ['/app/consolidated?year=2026&accountIds=acc-2'],
    })

    await screen.findByRole('heading', { name: 'Consolidado' })
    await screen.findByText('Receitas (ano)')

    expect(capturedSearch).toContain('year=2026')
    expect(capturedSearch).toContain('accountIds=acc-2')
  })

  it('deve expandir e recolher categoria na tabela de seção', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/reports/consolidated/years', () => ok({ years: [2026] })),
      http.get('*/reports/consolidated', () => ok(consolidatedMock)),
    )

    renderRouteWithProviders({
      initialEntries: ['/app/consolidated'],
    })

    await screen.findByRole('heading', { name: 'Consolidado' })
    await screen.findByText('Receitas Fixas')
    expect(screen.queryByText('Salário')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Expandir categoria Receitas Fixas/i }))
    expect(await screen.findByText('Salário')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Recolher categoria Receitas Fixas/i }))
    expect(screen.queryByText('Salário')).toBeNull()
  })

  it('deve mostrar visão de projeção quando toggle estiver ativo', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/reports/consolidated/years', () => ok({ years: [2026] })),
      http.get('*/reports/consolidated', () => ok(consolidatedMock)),
      http.get('*/recurrences/forecast', () => ok(forecastMock)),
    )

    renderRouteWithProviders({
      initialEntries: ['/app/consolidated'],
    })

    await screen.findByRole('heading', { name: 'Consolidado' })
    await screen.findByText('Receitas (ano)')
    const projectionButton = screen.getByRole('button', { name: 'Mostrar projeção' })
    await waitFor(() => expect(projectionButton).not.toBeDisabled())
    fireEvent.click(projectionButton)

    expect(await screen.findByText(/Visão com projeção/i)).toBeInTheDocument()
    expect(await screen.findByText('Receitas (combinado)')).toBeInTheDocument()
  })

  it('deve exibir fallback quando forecast falhar', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/reports/consolidated/years', () => ok({ years: [2026] })),
      http.get('*/reports/consolidated', () => ok(consolidatedMock)),
      http.get(
        '*/recurrences/forecast',
        () =>
          new Response(JSON.stringify({ message: 'erro forecast' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    renderRouteWithProviders({
      initialEntries: ['/app/consolidated'],
    })

    await screen.findByRole('heading', { name: 'Consolidado' })
    await screen.findByText('Receitas (ano)')
    const projectionButton = screen.getByRole('button', { name: 'Mostrar projeção' })
    await waitFor(() => expect(projectionButton).not.toBeDisabled())
    fireEvent.click(projectionButton)

    expect(
      await screen.findByText(/Não foi possível carregar projeção/i),
    ).toBeInTheDocument()
  })
})
