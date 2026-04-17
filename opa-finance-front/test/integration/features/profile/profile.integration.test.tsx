import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { logout, setAuth, type User } from '@/features/auth'
import type { Account } from '@/features/accounts'
import { fireEvent, renderRouteWithProviders, screen } from '../../../setup/render'
import { ok, server, serverError, unauthorized } from '../../../setup/msw'

const testUser: User = {
  id: 'user-1',
  name: 'Usuário Teste',
  email: 'teste@opafinance.fake',
  timezone: 'Australia/Adelaide',
  createdAt: '2026-04-01T00:00:00.000Z',
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

function mockProfileBaseHandlers() {
  return [
    http.get('*/version', () =>
      ok({
        version: '1.2.0',
        commit: 'abc123',
        buildTime: '2026-04-17T00:00:00.000Z',
      }),
    ),
    http.get('*/accounts', () => ok(accountsMock)),
  ] as const
}

describe('profile feature', () => {
  beforeEach(() => {
    localStorage.clear()
    setAuth('token-test', testUser)
  })

  afterEach(() => {
    logout()
    localStorage.clear()
  })

  it('deve atualizar perfil com payload esperado', async () => {
    let capturedPayload: { name: string; timezone: string } | null = null

    server.use(
      ...mockProfileBaseHandlers(),
      http.get('*/users/timezones', () =>
        ok({ data: ['Australia/Adelaide', 'UTC', 'America/Sao_Paulo'] }),
      ),
      http.put('*/users/user-1', async ({ request }) => {
        const payload = (await request.json()) as { name: string; timezone: string }
        capturedPayload = payload
        return ok({
          ...testUser,
          name: payload.name,
          timezone: payload.timezone,
        })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/profile'] })

    await screen.findByRole('heading', { name: 'Perfil' })
    const nameInput = screen.getByLabelText('Nome')
    fireEvent.change(nameInput, { target: { value: 'Nome Atualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Perfil atualizado com sucesso.')).toBeInTheDocument()
    expect(capturedPayload).toEqual({
      name: 'Nome Atualizado',
      timezone: 'Australia/Adelaide',
    })
  })

  it('deve usar fallback local quando catálogo de timezone falhar', async () => {
    server.use(
      ...mockProfileBaseHandlers(),
      http.get('*/users/timezones', () => serverError('Falha no catálogo')),
    )

    renderRouteWithProviders({ initialEntries: ['/app/profile'] })

    await screen.findByRole('heading', { name: 'Perfil' })
    expect(
      await screen.findByText(
        'Catálogo local em uso. Não foi possível carregar a lista completa do servidor.',
      ),
    ).toBeInTheDocument()
  })

  it('deve alterar senha com sucesso', async () => {
    let capturedPayload:
      | { currentPassword: string; newPassword: string; confirmNewPassword: string }
      | null = null

    server.use(
      ...mockProfileBaseHandlers(),
      http.get('*/users/timezones', () =>
        ok({ data: ['Australia/Adelaide', 'UTC', 'America/Sao_Paulo'] }),
      ),
      http.post('*/auth/change-password', async ({ request }) => {
        capturedPayload = (await request.json()) as {
          currentPassword: string
          newPassword: string
          confirmNewPassword: string
        }
        return ok({ success: true })
      }),
    )

    renderRouteWithProviders({ initialEntries: ['/app/profile'] })

    await screen.findByRole('heading', { name: 'Perfil' })
    fireEvent.change(screen.getByLabelText('Senha atual'), {
      target: { value: 'SenhaAtual@123' },
    })
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'NovaSenha@123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'NovaSenha@123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar senha' }))

    expect(await screen.findByText('Senha alterada com sucesso.')).toBeInTheDocument()
    expect(capturedPayload).toEqual({
      currentPassword: 'SenhaAtual@123',
      newPassword: 'NovaSenha@123',
      confirmNewPassword: 'NovaSenha@123',
    })
  })

  it('deve exibir erro amigável quando senha atual for inválida', async () => {
    server.use(
      ...mockProfileBaseHandlers(),
      http.get('*/users/timezones', () =>
        ok({ data: ['Australia/Adelaide', 'UTC', 'America/Sao_Paulo'] }),
      ),
      http.post('*/auth/change-password', () => unauthorized('Credenciais inválidas')),
    )

    renderRouteWithProviders({ initialEntries: ['/app/profile'] })

    await screen.findByRole('heading', { name: 'Perfil' })
    fireEvent.change(screen.getByLabelText('Senha atual'), {
      target: { value: 'SenhaErrada@123' },
    })
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'NovaSenha@123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'NovaSenha@123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar senha' }))

    expect(await screen.findByText('Senha atual incorreta.')).toBeInTheDocument()
  })
})
