import { fireEvent } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logout } from '@/features/auth'
import { renderRouteWithProviders, screen } from '../../../setup/render'
import { ok, server } from '../../../setup/msw'

describe('auth forms', () => {
  beforeEach(() => {
    logout()
    localStorage.clear()
  })

  afterEach(() => {
    logout()
    localStorage.clear()
    vi.unstubAllEnvs()
  })

  it('exibe erro amigável no login quando credenciais são inválidas', async () => {
    server.use(
      http.post('*/auth/login', () => HttpResponse.json({}, { status: 401 })),
    )

    renderRouteWithProviders({ initialEntries: ['/login'] })

    await screen.findByRole('heading', { name: 'Opa Finance' })

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@opafinance.fake' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'Senha@123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await screen.findByText('Email ou senha inválidos')
  })

  it('envia recuperação de senha e exibe mensagem de sucesso', async () => {
    server.use(
      http.post('*/auth/forgot-password', () =>
        ok({
          message: 'Se o email existir, enviaremos um link de redefinição.',
        }),
      ),
    )

    renderRouteWithProviders({ initialEntries: ['/forgot-password'] })

    await screen.findByRole('heading', { name: 'Recuperar senha' })

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@opafinance.fake' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar recuperação' }))

    await screen.findByText(
      'Se o email existir, enviaremos um link de redefinição.',
    )
  })

  it('exibe mensagem amigável quando o forgot-password é bloqueado por rate limit (429)', async () => {
    server.use(
      http.post('*/auth/forgot-password', () =>
        HttpResponse.json(
          {
            type: 'https://opa.dev/errors/too-many-requests',
            title: 'Too Many Requests',
            status: 429,
            detail: 'Muitas tentativas. Tente novamente em 3540s.',
          },
          { status: 429 },
        ),
      ),
    )

    renderRouteWithProviders({ initialEntries: ['/forgot-password'] })

    await screen.findByRole('heading', { name: 'Recuperar senha' })

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@opafinance.fake' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar recuperação' }))

    await screen.findByText('Muitas tentativas. Tente novamente em 3540s.')
  })

  it('mantém token da URL e exibe erro de reset quando API retorna 400', async () => {
    server.use(
      http.post('*/auth/reset-password', () =>
        HttpResponse.json({ detail: 'Token inválido ou expirado.' }, { status: 400 }),
      ),
    )

    renderRouteWithProviders({
      initialEntries: ['/reset-password?token=token-url-abc'],
    })

    await screen.findByRole('heading', { name: 'Redefinir senha' })

    expect(screen.getByLabelText('Token')).toHaveValue('token-url-abc')

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'NovaSenha@123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'NovaSenha@123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    await screen.findByText('Token inválido ou expirado.')
  })
})
