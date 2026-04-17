import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Account } from '@/features/accounts'
import { logout, setAuth, type User } from '@/features/auth'
import type { Category } from '@/features/categories'
import type { RecurrenceListResponse } from '@/features/recurrences'
import {
  fireEvent,
  renderRouteWithProviders,
  screen,
  waitFor,
  within,
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
    name: 'Pessoal',
    description: null,
    type: 'expense',
    system: false,
    color: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

const recurrencesMock: RecurrenceListResponse = {
  page: 1,
  limit: 20,
  total: 1,
  data: [
    {
      id: 'rec-1',
      userId: 'user-1',
      originType: 'transaction',
      status: 'active',
      timezone: 'Australia/Adelaide',
      frequency: 'monthly',
      startDate: '2026-04-01',
      dayOfWeek: null,
      dayOfMonth: 1,
      monthOfYear: null,
      endType: 'never',
      endOccurrences: null,
      endDate: null,
      accountId: 'acc-1',
      categoryId: 'cat-1',
      subcategoryId: null,
      fromAccountId: null,
      toAccountId: null,
      amount: 120,
      description: 'Academia',
      notes: null,
      nextOccurrenceDate: '2026-05-01',
      lastMaterializedDate: null,
      lastMaterializedAt: null,
      finalizedAt: null,
      deletedAt: null,
      version: 1,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
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

describe('recurrences feature', () => {
  beforeEach(() => {
    localStorage.clear()
    mockDesktopViewport()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    logout()
    localStorage.clear()
  })

  it('deve listar recorrências com dados básicos', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/recurrences', () => ok(recurrencesMock)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    expect(await screen.findByText('Academia')).toBeInTheDocument()
    expect(await screen.findByText('Mensal')).toBeInTheDocument()
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
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/recurrences', ({ request }) => {
        capturedSearch = new URL(request.url).search
        return ok({
          ...recurrencesMock,
          page: 2,
          limit: 50,
          total: 101,
        })
      }),
    )

    renderRouteWithProviders({
      initialEntries: [
        '/app/recurrences?page=2&limit=50&originType=transaction&status=active&frequency=monthly&accountId=acc-1&q=aca',
      ],
    })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    expect(capturedSearch).toContain('page=2')
    expect(capturedSearch).toContain('limit=50')
    expect(capturedSearch).toContain('originType=transaction')
    expect(capturedSearch).toContain('status=active')
    expect(capturedSearch).toContain('frequency=monthly')
    expect(capturedSearch).toContain('accountId=acc-1')
    expect(capturedSearch).toContain('q=aca')
    expect(screen.getByText('Página 2 de 3 · 101 registros')).toBeInTheDocument()
  })

  it('deve abrir modal de criação e fechar com Escape', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/recurrences', () => ok(recurrencesMock)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    fireEvent.click(screen.getByRole('button', { name: 'Nova recorrência' }))
    expect(
      await screen.findByText('Configure a regra para geração automática de lançamentos.'),
    ).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(
      screen.queryByText('Configure a regra para geração automática de lançamentos.'),
    ).toBeNull()
  })

  it('deve bloquear exclusão quando recorrência está ativa', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/recurrences', () => ok(recurrencesMock)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')
    fireEvent.click(
      screen.getByRole('button', { name: /Excluir recorrência ativa/i }),
    )

    expect(
      await screen.findByText('Finalize a recorrência antes de excluir.'),
    ).toBeInTheDocument()
  })

  it('deve finalizar recorrência ativa', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let finalizeCalled = false

    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.put('*/recurrences/:id/finalize', ({ params }) => {
        finalizeCalled = true
        return ok({
          ...recurrencesMock.data[0],
          id: String(params.id),
          status: 'finalized',
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Finalizar recorrência/i }))
    await waitFor(() => expect(finalizeCalled).toBe(true))
  })

  it('deve mostrar erro de conflito 409 ao salvar edição', async () => {
    let updateCalled = false

    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-17T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.put(
        '*/recurrences/:id',
        () => {
          updateCalled = true
          return new Response(JSON.stringify({ message: 'Conflito de versão' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      ),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Editar recorrência/i }))
    const modalHint = await screen.findByText(
      'Atualize os dados da regra e escolha o escopo da edição.',
    )
    const modal = modalHint.closest('div')?.parentElement
    if (!modal) {
      throw new Error('Modal de edição não encontrado')
    }

    const descriptionInput = within(modal).getByDisplayValue('Academia')
    fireEvent.change(descriptionInput, { target: { value: 'Academia atualizada' } })

    const saveButton = screen.getByRole('button', { name: 'Salvar edição' })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)
    await waitFor(() => expect(updateCalled).toBe(true))

    expect((await screen.findAllByText(/Conflito de edição:/i)).length).toBeGreaterThan(0)
  })
})
