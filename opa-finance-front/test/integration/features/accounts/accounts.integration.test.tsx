import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logout, setAuth, type User } from '@/features/auth'
import type { Account } from '@/features/accounts'
import { fireEvent, renderRouteWithProviders, screen, waitFor } from '../../../setup/render'
import { ok, server } from '../../../setup/msw'

const testUser: User = {
  id: 'user-1',
  name: 'Usuário Teste',
  email: 'teste@opafinance.fake',
  createdAt: '2026-04-12T00:00:00.000Z',
}

type StoreAccount = Account & {
  userId?: string
}

function makeAccountsStore() {
  return Array.from({ length: 12 }, (_, index) => {
    const number = index + 1
    return {
      id: `acc-${number}`,
      userId: 'user-1',
      name: `Conta ${number}`,
      type: number % 2 === 0 ? 'cash' : 'checking_account',
      currentBalance: number * 100,
      isPrimary: number === 1,
      isHiddenOnDashboard: false,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    } satisfies StoreAccount
  })
}

function useAccountsHandlers(accountsStore: StoreAccount[]) {
  let idCounter = accountsStore.length + 1

  server.use(
    http.get('*/version', () =>
      ok({
        version: '1.2.0',
        commit: 'abc123',
        buildTime: '2026-04-12T00:00:00.000Z',
      }),
    ),
    http.get('*/accounts', () => ok(accountsStore)),
    http.post('*/accounts', async ({ request }) => {
      const payload = (await request.json()) as Partial<StoreAccount>
      const created: StoreAccount = {
        id: `acc-${idCounter++}`,
        userId: 'user-1',
        name: payload.name ?? 'Conta sem nome',
        type: payload.type ?? 'cash',
        currentBalance: 0,
        isPrimary: false,
        isHiddenOnDashboard: false,
        createdAt: '2026-04-10T00:00:00.000Z',
        updatedAt: '2026-04-10T00:00:00.000Z',
      }
      accountsStore.push(created)
      return ok(created, { status: 201 })
    }),
    http.put('*/accounts/:id', async ({ params, request }) => {
      const id = String(params.id)
      const payload = (await request.json()) as Partial<StoreAccount>
      const target = accountsStore.find((account) => account.id === id)
      if (!target) {
        return ok({ message: 'Not found' }, { status: 404 })
      }
      Object.assign(target, payload, { updatedAt: '2026-04-11T00:00:00.000Z' })
      return ok(target)
    }),
    http.delete('*/accounts/:id', ({ params }) => {
      const id = String(params.id)
      const index = accountsStore.findIndex((account) => account.id === id)
      if (index >= 0) {
        accountsStore.splice(index, 1)
      }
      return ok({ success: true })
    }),
  )
}

describe('accounts page integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve listar, filtrar, sincronizar URL, paginar e abrir/fechar detalhe', async () => {
    const accountsStore = makeAccountsStore()
    useAccountsHandlers(accountsStore)

    const { router } = renderRouteWithProviders({
      initialEntries: ['/app/accounts'],
    })

    await screen.findByRole('heading', { name: 'Contas' })
    expect((await screen.findAllByText('Conta 1')).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
      target: { value: 'Conta 12' },
    })

    await waitFor(() => {
      expect(router.state.location.search.q).toBe('Conta 12')
    })
    expect((await screen.findAllByText('Conta 12')).length).toBeGreaterThan(0)

    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'cash' },
    })

    await waitFor(() => {
      expect(router.state.location.search.type).toBe('cash')
    })

    fireEvent.click(screen.getByRole('button', { name: /limpar filtros/i }))
    await waitFor(() => {
      expect(router.state.location.search.q).toBeUndefined()
      expect(router.state.location.search.type).toBeUndefined()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Proxima' }))
    await waitFor(() => {
      expect(router.state.location.search.page).toBe(2)
    })
    expect(await screen.findByText('Pagina 2 de 2')).toBeInTheDocument()

    fireEvent.click((await screen.findAllByText('Conta 12'))[0])
    expect(await screen.findByText('Detalhes da conta')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByText('Detalhes da conta')).not.toBeInTheDocument()
    })
  })

  it('deve executar create/edit/delete no happy path', async () => {
    const accountsStore = makeAccountsStore().slice(0, 2)
    useAccountsHandlers(accountsStore)

    renderRouteWithProviders({
      initialEntries: ['/app/accounts'],
    })

    await screen.findByRole('heading', { name: 'Contas' })

    fireEvent.click(screen.getByRole('button', { name: /nova conta/i }))
    expect(await screen.findByText('Criar nova conta')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Conta Integração' },
    })
    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'cash' },
    })
    fireEvent.click(screen.getByLabelText('Confirmo que os dados estão corretos'))
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect((await screen.findAllByText('Conta Integração')).length).toBeGreaterThan(
      0,
    )

    fireEvent.click((await screen.findAllByText('Conta Integração'))[0])
    expect(await screen.findByText('Detalhes da conta')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /editar/i }))

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Conta Integração Editada' },
    })
    fireEvent.click(
      screen.getByLabelText(
        'Confirmo que os dados estão corretos',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(
      (await screen.findAllByText('Conta Integração Editada')).length,
    ).toBeGreaterThan(0)

    fireEvent.click((await screen.findAllByText('Conta Integração Editada'))[0])
    await screen.findByText('Detalhes da conta')
    const deleteButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Excluir'))
    expect(deleteButton).toBeDefined()
    fireEvent.click(deleteButton as HTMLButtonElement)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    await waitFor(() => {
      expect(screen.queryByText('Conta Integração Editada')).not.toBeInTheDocument()
    })
  })

  it('deve exibir erro quando falha ao carregar contas', async () => {
    server.use(
      http.get('*/version', () =>
        ok({
          version: '1.2.0',
          commit: 'abc123',
          buildTime: '2026-04-12T00:00:00.000Z',
        }),
      ),
      http.get('*/accounts', () => ok({ message: 'boom' }, { status: 500 })),
    )

    renderRouteWithProviders({
      initialEntries: ['/app/accounts'],
    })

    await screen.findByRole('heading', { name: 'Contas' })
    expect(
      (await screen.findAllByText('Erro ao carregar contas. Tente novamente.'))
        .length,
    ).toBeGreaterThan(0)
  })
})
