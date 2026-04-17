import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { logout, setAuth, type User } from '@/features/auth'
import type { Account } from '@/features/accounts'
import type { WeeklyCashflowResponse } from '@/features/reports'
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
  createdAt: '2026-04-16T00:00:00.000Z',
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
    name: 'CommBank SAV',
    type: 'savings',
    currentBalance: 5000,
    isPrimary: false,
    isHiddenOnDashboard: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

const weeklyMock: WeeklyCashflowResponse = {
  year: 2026,
  weekStart: 'monday',
  appliedAccountIds: ['acc-1'],
  defaultAccountId: 'acc-1',
  summaryColumns: ['total', 'received', 'spent'],
  columnsCatalog: [
    {
      id: 'dyn-exp-1',
      label: 'Mercado',
      type: 'expense',
      scope: 'subcategory',
      categoryId: 'cat-1',
      categoryName: 'Habitação',
      subcategoryId: 'sub-1',
      subcategoryName: 'Mercado',
    },
    {
      id: 'dyn-exp-2',
      label: 'Aluguel',
      type: 'expense',
      scope: 'subcategory',
      categoryId: 'cat-1',
      categoryName: 'Habitação',
      subcategoryId: 'sub-2',
      subcategoryName: 'Aluguel',
    },
  ],
  weeks: [
    {
      week: 1,
      startDate: '2026-01-05',
      endDate: '2026-01-11',
      total: -300,
      received: 0,
      spent: 300,
      dynamicValues: {
        'dyn-exp-1': 100,
        'dyn-exp-2': 200,
      },
    },
    {
      week: 2,
      startDate: '2026-01-12',
      endDate: '2026-01-18',
      total: -350,
      received: 0,
      spent: 350,
      dynamicValues: {
        'dyn-exp-1': 150,
        'dyn-exp-2': 200,
      },
    },
  ],
}

function setupWeeklyHandlers(options?: {
  years?: number[]
  onWeeklyRequest?: (url: URL) => void
}) {
  const years = options?.years ?? [2026, 2025]

  server.use(
    http.get('*/version', () =>
      ok({
        version: '1.2.0',
        commit: 'abc123',
        buildTime: '2026-04-16T00:00:00.000Z',
      }),
    ),
    http.get('*/accounts', () => ok(accountsMock)),
    http.get('*/reports/consolidated/years', () => ok({ years })),
    http.get('*/reports/weekly-cashflow', ({ request }) => {
      options?.onWeeklyRequest?.(new URL(request.url))
      return ok(weeklyMock)
    }),
  )
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

function getViewStateStorageKey() {
  return `opa:weekly-flow:view-state:${testUser.id}`
}

describe('weekly-cashflow feature', () => {
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

    setupWeeklyHandlers({
      years: [2025, 2026],
      onWeeklyRequest: (url) => {
        capturedSearch = url.search
      },
    })

    renderRouteWithProviders({
      initialEntries: ['/app/weekly-cashflow?year=2025&weekStart=sunday&accountIds=acc-2'],
    })

    await screen.findByRole('heading', { name: 'Semanas' })
    await screen.findByRole('button', { name: /CommBank SAV/i })

    expect(capturedSearch).toContain('year=2025')
    expect(capturedSearch).toContain('weekStart=sunday')
    expect(capturedSearch).toContain('accountIds=acc-2')
  })

  it('deve permitir selecionar todas as colunas dinâmicas no modal de configuração', async () => {
    setupWeeklyHandlers()

    renderRouteWithProviders({ initialEntries: ['/app/weekly-cashflow'] })

    await screen.findByRole('heading', { name: 'Semanas' })
    await screen.findByText(/Nenhuma coluna dinâmica selecionada/i)

    fireEvent.click(screen.getByRole('button', { name: 'Configurar colunas' }))
    await screen.findByText('Configurar colunas dinâmicas')

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByText(/Nenhuma coluna dinâmica selecionada/i)).toBeNull()
    expect(await screen.findByText('Mercado')).toBeInTheDocument()
  })

  it('deve criar grupo e manter controles de ordenação disponíveis', async () => {
    setupWeeklyHandlers()
    localStorage.setItem(
      'opa:weekly-flow:view-state:user-1',
      JSON.stringify({
        version: 1,
        viewId: 'weekly-flow-default',
        selectedColumnIds: ['dyn-exp-1', 'dyn-exp-2'],
        columnOrder: ['dyn-exp-1', 'dyn-exp-2'],
        groups: [],
        groupDisplayModes: {},
        separatorPositions: [],
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/weekly-cashflow'] })

    await screen.findByRole('heading', { name: 'Semanas' })

    fireEvent.click(screen.getByRole('button', { name: 'Configurar colunas' }))
    await screen.findByText('Configurar colunas dinâmicas')
    expect(screen.getByRole('button', { name: '+ Separador' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }))

    const groupHeading = await screen.findByRole('heading', { name: 'Criar grupo' })
    const groupModal =
      groupHeading.closest('.relative.w-full.max-w-2xl') ??
      groupHeading.parentElement?.parentElement

    if (!groupModal) {
      throw new Error('Modal de criação de grupo não encontrado')
    }

    fireEvent.change(within(groupModal).getByPlaceholderText('Nome do grupo...'), {
      target: { value: 'Recorrentes' },
    })

    fireEvent.click(within(groupModal).getByLabelText(/Mercado/i))
    fireEvent.click(within(groupModal).getByLabelText(/Aluguel/i))

    const createGroupButton = within(groupModal).getByRole('button', { name: 'Criar grupo' })
    expect(createGroupButton).not.toBeDisabled()
    fireEvent.click(createGroupButton)

    expect((await screen.findAllByText('Recorrentes')).length).toBeGreaterThan(0)
  })

  it('deve permitir editar grupo existente no modal de configuração', async () => {
    setupWeeklyHandlers()
    localStorage.setItem(
      getViewStateStorageKey(),
      JSON.stringify({
        version: 1,
        viewId: 'weekly-flow-default',
        selectedColumnIds: ['dyn-exp-1', 'dyn-exp-2'],
        columnOrder: ['dyn-exp-1', 'dyn-exp-2', 'group:grp-1'],
        groups: [],
        groupDisplayModes: {},
        separatorPositions: [],
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/weekly-cashflow'] })

    await screen.findByRole('heading', { name: 'Semanas' })
    fireEvent.click(screen.getByRole('button', { name: 'Configurar colunas' }))
    const configHeading = await screen.findByRole('heading', {
      name: 'Configurar colunas dinâmicas',
    })
    const configModal =
      configHeading.closest('.relative.w-full.max-w-5xl') ??
      configHeading.parentElement?.parentElement

    if (!configModal) {
      throw new Error('Modal de configuração de colunas não encontrado')
    }

    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }))
    const createGroupHeading = await screen.findByRole('heading', { name: 'Criar grupo' })
    const createGroupModal =
      createGroupHeading.closest('.relative.w-full.max-w-2xl') ??
      createGroupHeading.parentElement?.parentElement

    if (!createGroupModal) {
      throw new Error('Modal de criação de grupo não encontrado')
    }

    fireEvent.change(within(createGroupModal).getByPlaceholderText('Nome do grupo...'), {
      target: { value: 'Recorrentes' },
    })
    fireEvent.click(within(createGroupModal).getByLabelText(/Mercado/i))
    fireEvent.click(within(createGroupModal).getByLabelText(/Aluguel/i))
    fireEvent.click(within(createGroupModal).getByRole('button', { name: 'Criar grupo' }))

    fireEvent.click(within(configModal).getByTitle('Editar grupo'))
    const editGroupHeading = await screen.findByRole('heading', { name: 'Editar grupo' })
    const editGroupModal =
      editGroupHeading.closest('.relative.w-full.max-w-2xl') ??
      editGroupHeading.parentElement?.parentElement

    if (!editGroupModal) {
      throw new Error('Modal de edição de grupo não encontrado')
    }

    const groupNameInput = within(editGroupModal).getByPlaceholderText('Nome do grupo...')
    expect(groupNameInput).toHaveValue('Recorrentes')
    fireEvent.change(groupNameInput, {
      target: { value: 'Fixos' },
    })
    expect(groupNameInput).toHaveValue('Fixos')
    fireEvent.click(within(editGroupModal).getByRole('button', { name: 'Salvar grupo' }))

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(getViewStateStorageKey()) ?? '{}')
      expect(persisted.groups[0].name).toBe('Fixos')
    })
  })

  it('deve persistir modo de exibição do grupo (M1/M2/M3) entre renderizações', async () => {
    setupWeeklyHandlers()
    localStorage.setItem(
      getViewStateStorageKey(),
      JSON.stringify({
        version: 1,
        viewId: 'weekly-flow-default',
        selectedColumnIds: ['dyn-exp-1', 'dyn-exp-2'],
        columnOrder: ['dyn-exp-1', 'dyn-exp-2'],
        groups: [],
        groupDisplayModes: {},
        separatorPositions: [],
      }),
    )

    const firstRender = renderRouteWithProviders({ initialEntries: ['/app/weekly-cashflow'] })

    await screen.findByRole('heading', { name: 'Semanas' })
    fireEvent.click(screen.getByRole('button', { name: 'Configurar colunas' }))
    await screen.findByText('Configurar colunas dinâmicas')

    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }))
    const createGroupHeading = await screen.findByRole('heading', { name: 'Criar grupo' })
    const createGroupModal =
      createGroupHeading.closest('.relative.w-full.max-w-2xl') ??
      createGroupHeading.parentElement?.parentElement
    if (!createGroupModal) {
      throw new Error('Modal de criação de grupo não encontrado')
    }
    fireEvent.change(within(createGroupModal).getByPlaceholderText('Nome do grupo...'), {
      target: { value: 'Recorrentes' },
    })
    fireEvent.click(within(createGroupModal).getByLabelText(/Mercado/i))
    fireEvent.click(within(createGroupModal).getByLabelText(/Aluguel/i))
    fireEvent.click(within(createGroupModal).getByRole('button', { name: 'Criar grupo' }))

    fireEvent.click(screen.getByRole('button', { name: 'M1' }))
    expect(await screen.findByRole('button', { name: 'M2' })).toBeInTheDocument()

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(getViewStateStorageKey()) ?? '{}')
      const groupId = persisted.groups?.[0]?.id
      expect(groupId).toBeTruthy()
      expect(persisted.groupDisplayModes[groupId]).toBe('children')
    })

    firstRender.unmount()

    renderRouteWithProviders({ initialEntries: ['/app/weekly-cashflow'] })
    await screen.findByRole('heading', { name: 'Semanas' })
    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(getViewStateStorageKey()) ?? '{}')
      const groupId = persisted.groups?.[0]?.id
      expect(groupId).toBeTruthy()
      expect(persisted.groupDisplayModes[groupId]).toBe('children')
    })
  })
})
