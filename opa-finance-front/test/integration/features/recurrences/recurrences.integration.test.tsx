import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Account } from '@/features/accounts'
import { logout, setAuth, type User } from '@/features/auth'
import type { Category } from '@/features/categories'
import type {
  RecurrenceListResponse,
  RecurrenceTimelineResponse,
} from '@/features/recurrences'
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
      pendingReviewCount: 1,
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

const recurrenceTimelineMock: RecurrenceTimelineResponse = {
  recurrence: recurrencesMock.data[0],
  summary: {
    totalOccurrences: 12,
    consumedOccurrences: 2,
    materializedOccurrences: 1,
    pendingReviewOccurrences: 1,
    skippedOccurrences: 0,
    failedOccurrences: 0,
    projectedOccurrences: 2,
    totalAmount: null,
    materializedAmount: 120,
    pendingReviewAmount: 120,
    projectedAmount: 240,
    appliedLimit: 24,
    isPartial: true,
    hasMoreProjected: true,
    projectionWindowLabel: 'Próximas 24 ocorrências',
  },
  items: [
    {
      id: 'occ-1',
      occurrenceDate: '2026-04-01',
      status: 'materialized',
      transactionId: 'tx-1',
      transferId: null,
      sequence: 1,
      source: 'persisted',
      amount: 120,
      version: 1,
      reviewPayload: null,
      canConfirm: false,
      canSkip: false,
    },
    {
      id: 'occ-2',
      occurrenceDate: '2026-05-01',
      status: 'pending_review',
      transactionId: null,
      transferId: null,
      sequence: 2,
      source: 'persisted',
      amount: 120,
      version: 7,
      reviewPayload: {
        occurrenceDate: '2026-05-01',
        originalScheduledDate: '2026-05-01',
        originType: 'transaction',
        amount: 120,
        description: 'Academia',
        notes: null,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        subcategoryId: null,
      },
      canConfirm: true,
      canSkip: true,
    },
    {
      id: null,
      sequence: 3,
      occurrenceDate: '2026-06-01',
      status: 'projected',
      source: 'projected',
      amount: 120,
      transactionId: null,
      transferId: null,
      version: null,
      reviewPayload: null,
      canConfirm: false,
      canSkip: false,
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
    expect(screen.getByText('1 pendência')).toBeInTheDocument()
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

  it('deve mostrar estado vazio sem paginação', async () => {
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
      http.get('*/recurrences', () =>
        ok({
          page: 1,
          limit: 20,
          total: 0,
          data: [],
        }),
      ),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    expect(
      await screen.findByText('Nenhuma recorrência encontrada para os filtros informados.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Página 1 de 1/i)).toBeNull()
  })

  it('deve mostrar estado de erro com ação de tentar novamente', async () => {
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
      http.get('*/recurrences', () =>
        new Response(JSON.stringify({ message: 'Falha inesperada' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    expect(
      await screen.findByText('Erro ao processar a solicitação. Tente novamente.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(screen.queryByText(/Página 1 de 1/i)).toBeNull()
  })

  it('deve abrir detalhes e timeline da recorrência', async () => {
    let capturedTimelineSearch = ''

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
      http.get('*/recurrences/:id/timeline', ({ request }) => {
        capturedTimelineSearch = new URL(request.url).search
        return ok(recurrenceTimelineMock)
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(
      screen.getByRole('button', { name: /Ver detalhes da recorrência Academia/i }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Detalhes da recorrência' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Linha do tempo')).toBeInTheDocument()
    const timelineTable = await screen.findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })
    expect(within(timelineTable).getAllByRole('row')).toHaveLength(4)
    expect(within(timelineTable).getByText('Parcela 2')).toBeInTheDocument()
    expect(within(timelineTable).getByText('Pendente de revisão')).toBeInTheDocument()
    expect(within(timelineTable).getByText('01/06/2026')).toBeInTheDocument()
    expect(within(timelineTable).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(within(timelineTable).getByRole('button', { name: 'Ignorar' })).toBeInTheDocument()
    expect(
      await screen.findByText('Esta recorrência tem pendências em aberto.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ignorar pendências em massa' }),
    ).toBeInTheDocument()
    expect(capturedTimelineSearch).toContain('limit=24')
  })

  it('deve ignorar pendências em massa na timeline', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Ajuste manual')
    const skipBodies: Record<string, unknown>[] = []

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
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.post('*/recurrences/occurrences/:id/skip', async ({ request }) => {
        skipBodies.push((await request.json()) as Record<string, unknown>)
        return ok({
          ...recurrenceTimelineMock.items[1],
          status: 'skipped',
          canConfirm: false,
          canSkip: false,
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')
    fireEvent.click(
      screen.getByRole('button', { name: /Ver detalhes da recorrência Academia/i }),
    )

    const bulkSkipButton = await screen.findByRole('button', {
      name: 'Ignorar pendências em massa',
    })
    fireEvent.click(bulkSkipButton)

    await waitFor(() => expect(skipBodies).toHaveLength(1))
    expect(confirmSpy).toHaveBeenCalled()
    expect(promptSpy).toHaveBeenCalled()
    expect(skipBodies[0]).toMatchObject({
      expectedVersion: 7,
      reason: 'Ajuste manual',
    })
  })

  it('deve confirmar pendência com modal e expectedVersion', async () => {
    let confirmBody: Record<string, unknown> | null = null

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
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.post('*/recurrences/occurrences/:id/confirm', async ({ request }) => {
        confirmBody = (await request.json()) as Record<string, unknown>
        return ok({
          ...recurrenceTimelineMock.items[1],
          status: 'materialized',
          transactionId: 'tx-confirmed',
          canConfirm: false,
          canSkip: false,
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')
    fireEvent.click(
      screen.getByRole('button', { name: /Ver detalhes da recorrência Academia/i }),
    )

    const timelineTable = await screen.findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })
    fireEvent.click(within(timelineTable).getByRole('button', { name: 'Confirmar' }))

    expect(
      await screen.findByRole('heading', { name: 'Confirmar lançamento' }),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-05-01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('$ 120,00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar lançamento' }))

    await waitFor(() => expect(confirmBody).not.toBeNull())
    expect(confirmBody).toMatchObject({
      expectedVersion: 7,
      occurrenceDate: '2026-05-01',
      amount: 120,
      description: 'Academia',
      accountId: 'acc-1',
      categoryId: 'cat-1',
    })
  })

  it('deve mostrar mensagem clara quando confirm retorna 422 por data fora do range', async () => {
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
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.post('*/recurrences/occurrences/:id/confirm', async ({ request }) => {
        const body = (await request.json()) as { occurrenceDate?: string }
        if (body.occurrenceDate === '2030-01-01') {
          return new Response(
            JSON.stringify({
              type: 'https://opa.dev/errors/validation-error',
              title: 'Validation Error',
              status: 422,
              detail: 'A data ajustada deve estar entre 01/05/2026 e 30/04/2027.',
              instance: '/recurrences/occurrences/occ-2/confirm',
            }),
            {
              status: 422,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
        return ok(recurrenceTimelineMock.items[1])
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')
    fireEvent.click(
      screen.getByRole('button', { name: /Ver detalhes da recorrência Academia/i }),
    )

    const timelineTable = await screen.findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })
    fireEvent.click(within(timelineTable).getByRole('button', { name: 'Confirmar' }))

    const dateInput = await screen.findByLabelText('Data do lançamento')
    fireEvent.change(dateInput, { target: { value: '2030-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar lançamento' }))

    expect(
      await screen.findByText('A data ajustada deve estar entre 01/05/2026 e 30/04/2027.'),
    ).toBeInTheDocument()
  })

  it('deve ignorar pendência com ação direta', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Esquecido')
    let skipBody: Record<string, unknown> | null = null

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
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.post('*/recurrences/occurrences/:id/skip', async ({ request }) => {
        skipBody = (await request.json()) as Record<string, unknown>
        return ok({
          ...recurrenceTimelineMock.items[1],
          status: 'skipped',
          canConfirm: false,
          canSkip: false,
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')
    fireEvent.click(
      screen.getByRole('button', { name: /Ver detalhes da recorrência Academia/i }),
    )

    const timelineTable = await screen.findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })
    fireEvent.click(within(timelineTable).getByRole('button', { name: 'Ignorar' }))

    await waitFor(() => expect(skipBody).not.toBeNull())
    expect(confirmSpy).toHaveBeenCalled()
    expect(promptSpy).toHaveBeenCalled()
    expect(skipBody).toMatchObject({
      expectedVersion: 7,
      reason: 'Esquecido',
    })
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
