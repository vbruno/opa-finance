import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { logout, setAuth, type User } from '@/features/auth'
import type { Account } from '@/features/accounts'
import type { AuditLogsResponse } from '@/features/audit'
import { fireEvent, renderRouteWithProviders, screen } from '../../../setup/render'
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
    name: 'CommBank ACC',
    type: 'checking',
    currentBalance: 1000,
    isPrimary: true,
    isHiddenOnDashboard: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

const auditMock: AuditLogsResponse = {
  page: 1,
  limit: 20,
  total: 1,
  data: [
    {
      id: 'log-1',
      userId: 'user-1',
      entityType: 'transaction',
      entityId: 'trx-1',
      action: 'create',
      beforeData: null,
      afterData: { accountId: 'acc-1', description: 'Mercado' },
      metadata: null,
      summary: {
        action: 'Criação',
        description: 'Mercado',
      },
      beforeDataFriendly: null,
      afterDataFriendly: {
        accountName: 'CommBank ACC',
      },
      metadataFriendly: null,
      createdAt: '2026-04-17T08:00:00.000Z',
    },
  ],
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

describe('audit feature', () => {
  beforeEach(() => {
    localStorage.clear()
    mockDesktopViewport()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve listar logs e abrir detalhe por clique na linha', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/audit-logs', () => ok(auditMock)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/audit'] })

    await screen.findByRole('heading', { name: 'Histórico' })
    await screen.findByText('Mercado')
    expect(await screen.findByText('CommBank ACC')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Mercado'))
    expect(await screen.findByText('Detalhes do log')).toBeInTheDocument()
    expect(await screen.findByText('Antes')).toBeInTheDocument()
    expect(await screen.findByText('Depois')).toBeInTheDocument()
  })

  it('deve respeitar filtros e paginação vindos da URL no carregamento inicial', async () => {
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
      http.get('*/audit-logs', ({ request }) => {
        capturedSearch = new URL(request.url).search
        return ok({
          ...auditMock,
          page: 3,
          limit: 50,
          total: 120,
        })
      }),
    )

    renderRouteWithProviders({
      initialEntries: [
        '/app/audit?page=3&limit=50&entityType=transaction&action=create&startDate=2026-04-01&endDate=2026-04-30',
      ],
    })

    await screen.findByRole('heading', { name: 'Histórico' })
    await screen.findByText('Mercado')

    expect(capturedSearch).toContain('page=3')
    expect(capturedSearch).toContain('limit=50')
    expect(capturedSearch).toContain('entityType=transaction')
    expect(capturedSearch).toContain('action=create')
    expect(capturedSearch).toContain('startDate=2026-04-01')
    expect(capturedSearch).toContain('endDate=2026-04-30')
    expect(screen.getByText('Página 3 de 3 • 120 registros')).toBeInTheDocument()
  })

  it('deve fechar modal de detalhes com Escape e com clique no backdrop', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/audit-logs', () => ok(auditMock)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/audit'] })

    await screen.findByRole('heading', { name: 'Histórico' })
    await screen.findByText('Mercado')

    fireEvent.click(screen.getByText('Mercado'))
    expect(await screen.findByText('Detalhes do log')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('Detalhes do log')).toBeNull()

    fireEvent.click(screen.getByText('Mercado'))
    expect(await screen.findByText('Detalhes do log')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('audit-detail-backdrop'))
    expect(screen.queryByText('Detalhes do log')).toBeNull()
  })
})
