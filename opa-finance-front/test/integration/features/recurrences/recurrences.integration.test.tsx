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
      postingMode: 'automatic',
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
      hasConsumedOccurrences: false,
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
      hasOverride: false,
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
      hasOverride: false,
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
      hasOverride: false,
    },
  ],
  pagination: {
    page: 1,
    limit: 12,
    hasMore: false,
    total: 3,
  },
}

const consumedRecurrenceMock = {
  ...recurrencesMock.data[0],
  hasConsumedOccurrences: true,
}

const consumedTimelineMock: RecurrenceTimelineResponse = {
  ...recurrenceTimelineMock,
  recurrence: consumedRecurrenceMock,
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

async function selectRecurrenceFormOption(
  modal: HTMLElement,
  fieldName: string,
  optionName: string,
) {
  const trigger = within(modal).getByRole('combobox', { name: fieldName })
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
  fireEvent.click(await screen.findByRole('option', { name: optionName }))
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
    expect(screen.getByText('Página 2 de 3 • 101 registros')).toBeInTheDocument()
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
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    fireEvent.click(screen.getByRole('button', { name: 'Nova recorrência' }))
    expect(
      await screen.findByRole('dialog', { name: 'Nova recorrência' }),
    ).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nova recorrência' })).toBeNull(),
    )
  })

  it('deve criar recorrência por data final', async () => {
    let capturedPayload: Record<string, unknown> | null = null

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
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.post('*/recurrences', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>
        return ok({
          ...recurrencesMock.data[0],
          frequency: 'monthly',
          dayOfWeek: null,
          dayOfMonth: 5,
          endType: 'until_date',
          endOccurrences: null,
          endDate: '2026-12-31',
          amount: 250,
          description: 'Notebook',
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    fireEvent.click(screen.getByRole('button', { name: 'Nova recorrência' }))

    const modal = await screen.findByRole('dialog', { name: 'Nova recorrência' })
    await selectRecurrenceFormOption(modal, 'Modo de lançamento', 'Automático')
    await selectRecurrenceFormOption(modal, 'Frequência', 'Mensal')
    fireEvent.change(within(modal).getByLabelText('Dia do mês'), {
      target: { value: '5' },
    })
    await selectRecurrenceFormOption(modal, 'Término', 'Por data final')
    fireEvent.change(await within(modal).findByLabelText('Data final'), {
      target: { value: '2026-12-31' },
    })
    await selectRecurrenceFormOption(modal, 'Conta', 'CommBank ACC')
    await selectRecurrenceFormOption(modal, 'Categoria/Subcategoria', 'Pessoal')
    fireEvent.change(within(modal).getByLabelText('Valor'), {
      target: { value: '25000' },
    })
    fireEvent.change(within(modal).getByLabelText('Descrição'), {
      target: { value: 'Notebook' },
    })

    const createButton = screen.getByRole('button', { name: 'Criar recorrência' })
    await waitFor(() => expect(createButton).not.toBeDisabled())
    fireEvent.click(createButton)

    await waitFor(() => expect(capturedPayload).not.toBeNull())
    expect(capturedPayload).toMatchObject({
      frequency: 'monthly',
      dayOfMonth: 5,
      endType: 'until_date',
      endDate: '2026-12-31',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      amount: 250,
      description: 'Notebook',
    })
    expect(capturedPayload).not.toHaveProperty('endOccurrences')
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
    const recurrenceWithNotes = {
      ...recurrencesMock.data[0],
      notes: 'Cobrar ajuste anual do plano',
    }
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
      http.get('*/recurrences', () =>
        ok({
          ...recurrencesMock,
          data: [recurrenceWithNotes],
        }),
      ),
      http.get('*/recurrences/:id/timeline', ({ request }) => {
        capturedTimelineSearch = new URL(request.url).search
        return ok({
          ...recurrenceTimelineMock,
          recurrence: recurrenceWithNotes,
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))

    expect(
      await screen.findByRole('heading', { name: 'Detalhes da recorrência' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Observações')).toBeInTheDocument()
    expect(screen.getByText('Cobrar ajuste anual do plano')).toBeInTheDocument()
    const timelineTable = await screen.findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })
    expect(within(timelineTable).getAllByRole('row')).toHaveLength(4)
    expect(within(timelineTable).getByText('2 / 12')).toBeInTheDocument()
    expect(within(timelineTable).getByText('Pendente de revisão')).toBeInTheDocument()
    expect(within(timelineTable).getByText('01/06/2026')).toBeInTheDocument()
    expect(
      within(timelineTable)
        .getAllByRole('button', { name: 'Confirmar ocorrência' })
        .some((button) => !button.hasAttribute('disabled')),
    ).toBe(true)
    expect(
      within(timelineTable)
        .getAllByRole('button', { name: 'Ignorar ocorrência' })
        .some((button) => !button.hasAttribute('disabled')),
    ).toBe(true)
    expect(
      await screen.findByText('Pendências em aberto bloqueiam finalizar ou excluir esta recorrência.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ignorar em massa' }),
    ).toBeInTheDocument()
    expect(capturedTimelineSearch).toContain('limit=12')
  })

  it('deve fechar o modal de detalhes ao pressionar Escape', async () => {
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
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')
    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))

    expect(
      await screen.findByRole('heading', { name: 'Detalhes da recorrência' }),
    ).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Detalhes da recorrência' })).toBeNull(),
    )
  })

  it('deve ignorar pendências em massa na timeline', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))

    const bulkSkipButton = await screen.findByRole('button', { name: 'Ignorar em massa' })
    fireEvent.click(bulkSkipButton)

    const confirmDialog = await screen.findByRole('alertdialog', {
      name: 'Ignorar 1 pendência(s)',
    })
    fireEvent.change(within(confirmDialog).getByLabelText('Motivo (opcional)'), {
      target: { value: 'Ajuste manual' },
    })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Ignorar todas' }))

    await waitFor(() => expect(skipBodies).toHaveLength(1))
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
      screen.getByRole('button', { name: /Academia.*Em execução/i }),
    )

    const timelineTable = await screen.findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })
    const confirmOccurrenceButton = within(timelineTable)
      .getAllByRole<HTMLButtonElement>('button', { name: 'Confirmar ocorrência' })
      .find((button) => !button.disabled)
    expect(confirmOccurrenceButton).toBeDefined()
    fireEvent.click(confirmOccurrenceButton as HTMLButtonElement)

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
      screen.getByRole('button', { name: /Academia.*Em execução/i }),
    )

    const timelineTable = await screen.findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })
    const confirmOccurrenceButton = within(timelineTable)
      .getAllByRole<HTMLButtonElement>('button', { name: 'Confirmar ocorrência' })
      .find((button) => !button.disabled)
    expect(confirmOccurrenceButton).toBeDefined()
    fireEvent.click(confirmOccurrenceButton as HTMLButtonElement)

    const dateInput = await screen.findByLabelText('Data do lançamento')
    fireEvent.change(dateInput, { target: { value: '2030-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar lançamento' }))

    expect(
      await screen.findByText('A data ajustada deve estar entre 01/05/2026 e 30/04/2027.'),
    ).toBeInTheDocument()
  })

  it('deve ignorar pendência com ação direta', async () => {
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
      screen.getByRole('button', { name: /Academia.*Em execução/i }),
    )

    const timelineTable = await screen.findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })
    const skipOccurrenceButton = within(timelineTable)
      .getAllByRole<HTMLButtonElement>('button', { name: 'Ignorar ocorrência' })
      .find((button) => !button.disabled)
    expect(skipOccurrenceButton).toBeDefined()
    fireEvent.click(skipOccurrenceButton as HTMLButtonElement)

    const confirmDialog = await screen.findByRole('alertdialog', {
      name: 'Ignorar pendência',
    })
    fireEvent.change(within(confirmDialog).getByLabelText('Motivo (opcional)'), {
      target: { value: 'Esquecido' },
    })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Ignorar' }))

    await waitFor(() => expect(skipBody).not.toBeNull())
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
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })

    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')
    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', {
      name: 'Detalhes da recorrência',
    })
    fireEvent.click(within(detailsModal).getByRole('button', { name: 'Excluir recorrência' }))

    expect(
      await within(detailsModal).findByText('Finalize a recorrência antes de excluir.'),
    ).toBeInTheDocument()
  })

  it('deve finalizar recorrência ativa', async () => {
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
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.put('*/recurrences/:id/finalize', ({ params }) => {
        finalizeCalled = true
        return ok({
          ...recurrencesMock.data[0],
          id: String(params.id),
          status: 'finalized',
          finalizedAt: '2026-05-05T00:00:00.000Z',
          updatedAt: '2026-05-05T00:00:00.000Z',
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', {
      name: 'Detalhes da recorrência',
    })

    fireEvent.click(within(detailsModal).getByRole('button', { name: 'Finalizar' }))
    const confirmDialog = await screen.findByRole('alertdialog', {
      name: 'Finalizar recorrência',
    })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Finalizar' }))

    await waitFor(() => expect(finalizeCalled).toBe(true))
    await waitFor(() =>
      expect(within(detailsModal).getByText('Finalizada')).toBeInTheDocument(),
    )
    expect(
      within(detailsModal).queryByRole('button', { name: 'Finalizar' }),
    ).not.toBeInTheDocument()
    expect(
      within(detailsModal).queryByRole('button', { name: 'Editar recorrência' }),
    ).not.toBeInTheDocument()
    expect(
      within(detailsModal).getByRole('button', { name: 'Excluir recorrência' }),
    ).toBeInTheDocument()
  })

  it('deve fechar detalhes após excluir recorrência finalizada', async () => {
    let deleteCalled = false
    let deleted = false
    const finalizedRecurrencesMock: RecurrenceListResponse = {
      ...recurrencesMock,
      data: [
        {
          ...recurrencesMock.data[0],
          description: 'Notebook',
          status: 'finalized',
          pendingReviewCount: 0,
          finalizedAt: '2026-05-05T00:00:00.000Z',
        },
      ],
    }
    const finalizedTimelineMock: RecurrenceTimelineResponse = {
      ...recurrenceTimelineMock,
      recurrence: finalizedRecurrencesMock.data[0],
      items: [],
      pagination: {
        page: 1,
        limit: 12,
        hasMore: false,
        total: 0,
      },
    }

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
        ok(deleted ? { ...finalizedRecurrencesMock, data: [], total: 0 } : finalizedRecurrencesMock),
      ),
      http.get('*/recurrences/:id/timeline', () => {
        if (deleted) {
          return new Response(JSON.stringify({ message: 'Recorrência não encontrada.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return ok(finalizedTimelineMock)
      }),
      http.delete('*/recurrences/:id', () => {
        deleteCalled = true
        deleted = true
        return new Response(null, { status: 204 })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Notebook')

    fireEvent.click(screen.getByRole('button', { name: /Notebook.*Finalizada/i }))
    const detailsModal = await screen.findByRole('dialog', {
      name: 'Detalhes da recorrência',
    })

    fireEvent.click(within(detailsModal).getByRole('button', { name: 'Excluir recorrência' }))
    const confirmDialog = await screen.findByRole('alertdialog', {
      name: 'Excluir recorrência',
    })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(deleteCalled).toBe(true))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Detalhes da recorrência' }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('Recorrência não encontrada.')).not.toBeInTheDocument()
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

    fireEvent.click(
      screen.getByRole('button', { name: /Academia.*Em execução/i }),
    )

    const detailsModal = await screen.findByRole('dialog', {
      name: 'Detalhes da recorrência',
    })
    fireEvent.click(within(detailsModal).getByRole('button', { name: /Editar recorrência/i }))

    const modal = await screen.findByRole('dialog', { name: 'Editar recorrência' })

    expect(within(modal).getByRole('combobox', { name: 'Modo de lançamento' })).toHaveTextContent('Automático')
    expect(within(modal).getByRole('combobox', { name: 'Origem' })).toHaveTextContent('Transação')
    expect(within(modal).getByRole('combobox', { name: 'Frequência' })).toHaveTextContent('Mensal')
    expect(within(modal).getByRole('spinbutton', { name: 'Dia do mês' })).toHaveValue(1)
    expect(within(modal).getByRole('combobox', { name: 'Término' })).toHaveTextContent('Sem fim')
    expect(within(modal).getByRole('combobox', { name: 'Conta' })).toHaveTextContent('CommBank ACC')
    expect(within(modal).getByRole('combobox', { name: 'Categoria/Subcategoria' })).toHaveTextContent('Pessoal')
    expect(within(modal).getByDisplayValue('Academia')).toBeInTheDocument()

    const descriptionInput = within(modal).getByDisplayValue('Academia')
    fireEvent.change(descriptionInput, { target: { value: 'Academia atualizada' } })

    const saveButton = screen.getByRole('button', { name: 'Salvar edição' })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)
    await waitFor(() => expect(updateCalled).toBe(true))

    expect((await screen.findAllByText(/Conflito de edição:/i)).length).toBeGreaterThan(0)
  })

  it('deve recarregar os dados mais recentes antes de abrir a edição', async () => {
    const latestRecurrence = {
      ...recurrencesMock.data[0],
      postingMode: 'review_required' as const,
      frequency: 'yearly' as const,
      dayOfWeek: null,
      dayOfMonth: 15,
      monthOfYear: 12,
      endType: 'until_date' as const,
      endOccurrences: null,
      endDate: '2026-12-31',
      version: 2,
      description: 'Academia atualizada',
      updatedAt: '2026-05-05T00:00:00.000Z',
    }

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
      http.get('*/recurrences/:id', () => ok(latestRecurrence)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))

    const detailsModal = await screen.findByRole('dialog', {
      name: 'Detalhes da recorrência',
    })
    fireEvent.click(within(detailsModal).getByRole('button', { name: /Editar recorrência/i }))

    const modal = await screen.findByRole('dialog', { name: 'Editar recorrência' })

    expect(within(modal).getByRole('combobox', { name: 'Modo de lançamento' })).toHaveTextContent('Com revisão')
    expect(within(modal).getByRole('combobox', { name: 'Frequência' })).toHaveTextContent('Anual')
    expect(within(modal).getByRole('spinbutton', { name: 'Dia do mês' })).toHaveValue(15)
    expect(within(modal).getByRole('combobox', { name: 'Mês' })).toHaveTextContent('Dezembro')
    expect(within(modal).getByRole('combobox', { name: 'Término' })).toHaveTextContent('Por data final')
    expect(within(modal).getByDisplayValue('2026-12-31')).toBeInTheDocument()
    expect(within(modal).getByDisplayValue('Academia atualizada')).toBeInTheDocument()
  })

  it('deve sincronizar dia da semana ao alterar data inicial em recorrência semanal', async () => {
    const latestRecurrence = {
      ...recurrencesMock.data[0],
      frequency: 'weekly' as const,
      startDate: '2026-05-05',
      dayOfWeek: 2,
      dayOfMonth: null,
      monthOfYear: null,
      endType: 'by_occurrences' as const,
      endOccurrences: 5,
    }

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
      http.get('*/recurrences/:id', () => ok(latestRecurrence)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))

    const detailsModal = await screen.findByRole('dialog', {
      name: 'Detalhes da recorrência',
    })
    fireEvent.click(within(detailsModal).getByRole('button', { name: /Editar recorrência/i }))

    const modal = await screen.findByRole('dialog', { name: 'Editar recorrência' })
    const dayOfWeekField = within(modal).getByLabelText('Dia da semana')
    expect(dayOfWeekField).toHaveValue('Terça')
    expect(dayOfWeekField).toHaveAttribute('readonly')

    fireEvent.change(within(modal).getByLabelText('Data inicial'), {
      target: { value: '2026-05-07' },
    })

    await waitFor(() =>
      expect(within(modal).getByLabelText('Dia da semana')).toHaveValue('Quinta'),
    )
  })

  it('deve preservar término por ocorrências quando editar apenas a descrição', async () => {
    const recurrenceWithOccurrences = {
      ...recurrencesMock.data[0],
      endType: 'by_occurrences' as const,
      endOccurrences: 5,
      endDate: null,
    }

    let capturedPayload: Record<string, unknown> | null = null

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
      http.get('*/recurrences', () =>
        ok({
          ...recurrencesMock,
          data: [recurrenceWithOccurrences],
        }),
      ),
      http.get('*/recurrences/:id', () => ok(recurrenceWithOccurrences)),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.put('*/recurrences/:id', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>
        return ok({
          ...recurrenceWithOccurrences,
          description: 'Academia atualizada',
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))

    const detailsModal = await screen.findByRole('dialog', {
      name: 'Detalhes da recorrência',
    })
    fireEvent.click(within(detailsModal).getByRole('button', { name: /Editar recorrência/i }))

    const modal = await screen.findByRole('dialog', { name: 'Editar recorrência' })
    const descriptionInput = within(modal).getByDisplayValue('Academia')
    fireEvent.change(descriptionInput, { target: { value: 'Academia atualizada' } })

    const saveButton = screen.getByRole('button', { name: 'Salvar edição' })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)

    await waitFor(() => expect(capturedPayload).not.toBeNull())
    expect(capturedPayload).toMatchObject({
      endType: 'by_occurrences',
      endOccurrences: 5,
      description: 'Academia atualizada',
      expectedVersion: 1,
    })
    expect(capturedPayload).not.toHaveProperty('notes')
    expect(capturedPayload).not.toMatchObject({
      endType: 'never',
    })
    await waitFor(() =>
      expect(within(detailsModal).getByText('Academia atualizada')).toBeInTheDocument(),
    )
  })

  it('deve salvar troca de término por ocorrências para data final', async () => {
    const recurrenceWithOccurrences = {
      ...recurrencesMock.data[0],
      endType: 'by_occurrences' as const,
      endOccurrences: 5,
      endDate: null,
    }

    let capturedPayload: Record<string, unknown> | null = null

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
      http.get('*/recurrences', () =>
        ok({
          ...recurrencesMock,
          data: [recurrenceWithOccurrences],
        }),
      ),
      http.get('*/recurrences/:id', () => ok(recurrenceWithOccurrences)),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.put('*/recurrences/:id', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>
        return ok({
          ...recurrenceWithOccurrences,
          endType: 'until_date',
          endOccurrences: null,
          endDate: '2026-12-31',
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))

    const detailsModal = await screen.findByRole('dialog', {
      name: 'Detalhes da recorrência',
    })
    fireEvent.click(within(detailsModal).getByRole('button', { name: /Editar recorrência/i }))

    const modal = await screen.findByRole('dialog', { name: 'Editar recorrência' })
    expect(within(modal).getByRole('combobox', { name: 'Término' })).toHaveTextContent('Por ocorrências')

    await selectRecurrenceFormOption(modal, 'Término', 'Por data final')
    fireEvent.change(await within(modal).findByLabelText('Data final'), {
      target: { value: '2026-12-31' },
    })

    const saveButton = screen.getByRole('button', { name: 'Salvar edição' })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)

    await waitFor(() => expect(capturedPayload).not.toBeNull())
    expect(capturedPayload).toMatchObject({
      endType: 'until_date',
      endDate: '2026-12-31',
      expectedVersion: 1,
    })
    expect(capturedPayload).not.toHaveProperty('endOccurrences')
    expect(capturedPayload).not.toMatchObject({
      endType: 'never',
    })
  })

  it('deve abrir edição global pelo topo sem mostrar seletor de escopo', async () => {
    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    fireEvent.click(within(detailsModal).getByRole('button', { name: /Editar recorrência/i }))

    const formModal = await screen.findByRole('dialog', { name: 'Editar recorrência' })
    expect(within(formModal).queryByRole('combobox', { name: 'Aplicar edição em' })).not.toBeInTheDocument()
    expect(within(formModal).queryByText('Todas')).not.toBeInTheDocument()
    expect(within(formModal).queryByText('Somente esta')).not.toBeInTheDocument()
    expect(within(formModal).queryByText('Esta e próximas')).not.toBeInTheDocument()
  })

  it('deve exibir bloqueio estrutural ao editar recorrência consumida', async () => {
    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () =>
        ok({ ...recurrencesMock, data: [consumedRecurrenceMock] }),
      ),
      http.get('*/recurrences/:id', () => ok(consumedRecurrenceMock)),
      http.get('*/recurrences/:id/timeline', () => ok(consumedTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    fireEvent.click(within(detailsModal).getByRole('button', { name: /Editar recorrência/i }))

    const formModal = await screen.findByRole('dialog', { name: 'Editar recorrência' })
    expect(
      within(formModal).getByText(
        /Esta recorrência já possui ocorrências geradas\. Para alterar valor, agenda, conta ou categoria das próximas/i,
      ),
    ).toBeInTheDocument()

    expect(within(formModal).getByRole('combobox', { name: 'Modo de lançamento' })).toBeDisabled()
    expect(within(formModal).getByRole('combobox', { name: 'Frequência' })).toBeDisabled()
    expect(within(formModal).getByLabelText('Data inicial')).toBeDisabled()
    expect(within(formModal).getByRole('combobox', { name: 'Término' })).toBeDisabled()
    expect(within(formModal).getByRole('combobox', { name: 'Conta' })).toBeDisabled()
    expect(within(formModal).getByRole('combobox', { name: 'Categoria/Subcategoria' })).toBeDisabled()
    expect(within(formModal).getByLabelText('Valor')).toBeDisabled()

    expect(within(formModal).getByLabelText('Descrição')).not.toBeDisabled()
    expect(within(formModal).getByLabelText('Observações')).not.toBeDisabled()
  })

  it('deve enviar somente description e notes no save global de recorrência consumida', async () => {
    let capturedPayload: Record<string, unknown> | null = null

    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () =>
        ok({ ...recurrencesMock, data: [consumedRecurrenceMock] }),
      ),
      http.get('*/recurrences/:id', () => ok(consumedRecurrenceMock)),
      http.get('*/recurrences/:id/timeline', () => ok(consumedTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.put('*/recurrences/:id', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>
        return ok({
          ...consumedRecurrenceMock,
          description: 'Academia premium',
          notes: 'Ajuste textual permitido',
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    fireEvent.click(within(detailsModal).getByRole('button', { name: /Editar recorrência/i }))

    const formModal = await screen.findByRole('dialog', { name: 'Editar recorrência' })
    fireEvent.change(within(formModal).getByLabelText('Descrição'), {
      target: { value: 'Academia premium' },
    })
    fireEvent.change(within(formModal).getByLabelText('Observações'), {
      target: { value: 'Ajuste textual permitido' },
    })

    fireEvent.click(within(formModal).getByRole('button', { name: 'Salvar edição' }))

    await waitFor(() => expect(capturedPayload).not.toBeNull())
    expect(capturedPayload).toEqual({
      description: 'Academia premium',
      notes: 'Ajuste textual permitido',
      expectedVersion: consumedRecurrenceMock.version,
    })
  })

  it('deve manter formulário completo para recorrência sem bloqueio estrutural', async () => {
    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    fireEvent.click(within(detailsModal).getByRole('button', { name: /Editar recorrência/i }))

    const formModal = await screen.findByRole('dialog', { name: 'Editar recorrência' })
    expect(
      within(formModal).queryByText(/Esta recorrência já possui ocorrências geradas/i),
    ).not.toBeInTheDocument()
    expect(within(formModal).getByRole('combobox', { name: 'Frequência' })).not.toBeDisabled()
    expect(within(formModal).getByLabelText('Valor')).not.toBeDisabled()
  })

  it('deve abrir edição contextual por linha da timeline com default Somente esta', async () => {
    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    const timelineTable = await within(detailsModal).findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })

    const editButtons = within(timelineTable).getAllByRole('button', { name: 'Editar ocorrência' })
    expect(editButtons.length).toBeGreaterThan(0)
    fireEvent.click(editButtons[0])

    const formModal = await screen.findByRole('dialog', { name: 'Editar ocorrência' })
    expect(formModal).toBeInTheDocument()

    const scopeCombobox = within(formModal).getByRole('combobox', { name: 'Aplicar edição em' })
    expect(scopeCombobox).toHaveTextContent('Somente esta')
    expect(
      within(formModal).getByText('As alterações serão aplicadas somente nesta ocorrência selecionada.'),
    ).toBeInTheDocument()
  })

  it('deve garantir que Todas não aparece na edição por linha', async () => {
    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    const timelineTable = await within(detailsModal).findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })

    const editButtons = within(timelineTable).getAllByRole('button', { name: 'Editar ocorrência' })
    fireEvent.click(editButtons[0])

    const formModal = await screen.findByRole('dialog', { name: 'Editar ocorrência' })

    const trigger = within(formModal).getByRole('combobox', { name: 'Aplicar edição em' })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Todas' })).not.toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Somente esta' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Esta e próximas' })).toBeInTheDocument()
    })
  })

  it('deve abrir ocorrência projetada em modo override sem seletor de escopo', async () => {
    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    const timelineTable = await within(detailsModal).findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })

    // editButtons[1] é o item projected (editButtons[0] é pending_review)
    const editButtons = within(timelineTable).getAllByRole('button', { name: 'Editar ocorrência' })
    expect(editButtons.length).toBe(2)
    fireEvent.click(editButtons[1])

    const formModal = await screen.findByRole('dialog', { name: 'Editar ocorrência' })
    expect(within(formModal).queryByRole('combobox', { name: 'Aplicar edição em' })).not.toBeInTheDocument()
    expect(within(formModal).queryByRole('combobox', { name: 'Modo de lançamento' })).not.toBeInTheDocument()
    expect(within(formModal).queryByRole('combobox', { name: 'Frequência' })).not.toBeInTheDocument()
    expect(
      within(formModal).getByText('Esta edição será aplicada somente nesta ocorrência projetada selecionada.'),
    ).toBeInTheDocument()
  })

  it('override deve enviar payload pontual para ocorrência projetada', async () => {
    let capturedPayload: Record<string, unknown> | null = null

    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.put('*/recurrences/:id/occurrences/override', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>
        return ok({
          id: 'override-1',
          recurrenceId: 'rec-1',
          userId: 'user-1',
          occurrenceDate: '2026-06-01',
          amount: 175,
          description: 'Academia ajustada',
          notes: null,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    const timelineTable = await within(detailsModal).findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })

    const editButtons = within(timelineTable).getAllByRole('button', { name: 'Editar ocorrência' })
    fireEvent.click(editButtons[1])

    const formModal = await screen.findByRole('dialog', { name: 'Editar ocorrência' })
    fireEvent.change(within(formModal).getByLabelText('Valor'), { target: { value: '$ 175,00' } })
    fireEvent.change(within(formModal).getByLabelText('Descrição'), {
      target: { value: 'Academia ajustada' },
    })

    const saveButton = within(formModal).getByRole('button', { name: 'Salvar edição' })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)

    await waitFor(() => expect(capturedPayload).not.toBeNull())
    expect(capturedPayload).toMatchObject({
      occurrenceDate: '2026-06-01',
      amount: 175,
      description: 'Academia ajustada',
      notes: null,
    })
    expect(capturedPayload).not.toHaveProperty('scope')
    expect(capturedPayload).not.toHaveProperty('changes')
    expect(capturedPayload).not.toHaveProperty('frequency')
    expect(capturedPayload).not.toHaveProperty('accountId')
  })

  it('override deve exibir marcador visual na linha projetada ajustada', async () => {
    const timelineWithOverride: RecurrenceTimelineResponse = {
      ...recurrenceTimelineMock,
      items: recurrenceTimelineMock.items.map((item) =>
        item.status === 'projected'
          ? { ...item, amount: 175, canConfirm: true, hasOverride: true }
          : item,
      ),
    }

    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(timelineWithOverride)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })

    expect(await within(detailsModal).findByText('Ajustada')).toBeInTheDocument()
  })

  it('override deve preencher edição de ocorrência projetada com valor ajustado', async () => {
    const timelineWithOverride: RecurrenceTimelineResponse = {
      ...recurrenceTimelineMock,
      items: recurrenceTimelineMock.items.map((item) =>
        item.status === 'projected'
          ? { ...item, amount: 175, hasOverride: true }
          : item,
      ),
    }

    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(timelineWithOverride)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    const projectedDateCell = await within(detailsModal).findByText('01/06/2026')
    const projectedRow = projectedDateCell.closest('tr')
    expect(projectedRow).not.toBeNull()

    fireEvent.click(
      within(projectedRow as HTMLElement).getByRole('button', { name: 'Editar ocorrência' }),
    )

    const formModal = await screen.findByRole('dialog', { name: 'Editar ocorrência' })
    expect(within(formModal).getByLabelText('Valor')).toHaveValue('$ 175,00')
  })

  it('override deve preencher confirmação de ocorrência projetada com valor ajustado', async () => {
    const timelineWithOverride: RecurrenceTimelineResponse = {
      ...recurrenceTimelineMock,
      items: recurrenceTimelineMock.items.map((item) =>
        item.status === 'projected'
          ? { ...item, amount: 175, canConfirm: true, hasOverride: true }
          : item,
      ),
    }

    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id/timeline', () => ok(timelineWithOverride)),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    const projectedDateCell = await within(detailsModal).findByText('01/06/2026')
    const projectedRow = projectedDateCell.closest('tr')
    expect(projectedRow).not.toBeNull()

    fireEvent.click(
      within(projectedRow as HTMLElement).getByRole('button', { name: 'Confirmar ocorrência' }),
    )

    expect(await screen.findByRole('heading', { name: 'Confirmar lançamento' })).toBeInTheDocument()
    expect(screen.getByLabelText('Valor')).toHaveValue('$ 175,00')
    expect(screen.getByLabelText('Conta')).toHaveValue('CommBank ACC')
    expect(screen.getByLabelText('Categoria')).toHaveValue('Pessoal')
    expect(screen.getByLabelText('Subcategoria')).toHaveValue('Sem subcategoria')
    expect(screen.getByLabelText('Conta')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Categoria')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Subcategoria')).toHaveAttribute('readonly')
    expect(screen.queryByRole('combobox', { name: 'Conta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Categoria' })).not.toBeInTheDocument()
  })

  it('deve enviar payload single com apenas amount, description e notes', async () => {
    let capturedPayload: Record<string, unknown> | null = null

    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.put('*/recurrences/:id/edit-scope', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>
        return ok(recurrencesMock.data[0])
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    const timelineTable = await within(detailsModal).findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })

    const editButtons = within(timelineTable).getAllByRole('button', { name: 'Editar ocorrência' })
    fireEvent.click(editButtons[0])

    const formModal = await screen.findByRole('dialog', { name: 'Editar ocorrência' })

    const amountInput = within(formModal).getByLabelText('Valor')
    fireEvent.change(amountInput, { target: { value: '$ 200,00' } })

    const saveButton = within(formModal).getByRole('button', { name: 'Salvar edição' })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)

    await waitFor(() => expect(capturedPayload).not.toBeNull())
    expect(capturedPayload).toMatchObject({
      scope: 'single',
      changes: { amount: 200 },
    })
    expect((capturedPayload?.changes as Record<string, unknown>)).not.toHaveProperty('frequency')
    expect((capturedPayload?.changes as Record<string, unknown>)).not.toHaveProperty('accountId')
    expect((capturedPayload?.changes as Record<string, unknown>)).not.toHaveProperty('categoryId')
    expect((capturedPayload?.changes as Record<string, unknown>)).not.toHaveProperty('postingMode')
  })

  it('deve enviar payload this_and_next com apenas amount, description e notes', async () => {
    let capturedPayload: Record<string, unknown> | null = null

    server.use(
      http.get('*/version', () =>
        ok({ version: '1.2.0', commit: 'abc123', buildTime: '2026-04-17T00:00:00.000Z' }),
      ),
      http.get('*/accounts', () => ok(accountsMock)),
      http.get('*/categories', () => ok(categoriesMock)),
      http.get('*/categories/:categoryId/subcategories', () => ok([])),
      http.get('*/recurrences', () => ok(recurrencesMock)),
      http.get('*/recurrences/:id', () => ok(recurrencesMock.data[0])),
      http.get('*/recurrences/:id/timeline', () => ok(recurrenceTimelineMock)),
      http.get('*/transactions/descriptions', () => ok({ items: [] })),
      http.put('*/recurrences/:id/edit-scope', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>
        return ok(recurrencesMock.data[0])
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/recurrences'] })
    await screen.findByRole('heading', { name: 'Recorrências' })
    await screen.findByText('Academia')

    fireEvent.click(screen.getByRole('button', { name: /Academia.*Em execução/i }))
    const detailsModal = await screen.findByRole('dialog', { name: 'Detalhes da recorrência' })
    const timelineTable = await within(detailsModal).findByRole('table', {
      name: 'Tabela de ocorrências da recorrência',
    })

    const editButtons = within(timelineTable).getAllByRole('button', { name: 'Editar ocorrência' })
    fireEvent.click(editButtons[0])

    const formModal = await screen.findByRole('dialog', { name: 'Editar ocorrência' })

    await selectRecurrenceFormOption(formModal, 'Aplicar edição em', 'Esta e próximas')
    expect(
      within(formModal).getByText(
        'As alterações serão aplicadas nesta ocorrência e em todas as próximas a partir da linha selecionada.',
      ),
    ).toBeInTheDocument()

    const amountInput = within(formModal).getByLabelText('Valor')
    fireEvent.change(amountInput, { target: { value: '$ 150,00' } })

    const saveButton = within(formModal).getByRole('button', { name: 'Salvar edição' })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)

    await waitFor(() => expect(capturedPayload).not.toBeNull())
    expect(capturedPayload).toMatchObject({
      scope: 'this_and_next',
      changes: { amount: 150 },
    })
    expect((capturedPayload?.changes as Record<string, unknown>)).not.toHaveProperty('frequency')
    expect((capturedPayload?.changes as Record<string, unknown>)).not.toHaveProperty('startDate')
    expect((capturedPayload?.changes as Record<string, unknown>)).not.toHaveProperty('accountId')
  })
})
