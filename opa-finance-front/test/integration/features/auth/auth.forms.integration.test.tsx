import { fireEvent } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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

  it('envia recuperação de senha e exibe token de teste', async () => {
    server.use(
      http.post('*/auth/forgot-password', () =>
        ok({
          message: 'Instruções enviadas para o email informado.',
          resetToken: 'token-teste-123',
        }),
      ),
    )

    renderRouteWithProviders({ initialEntries: ['/forgot-password'] })

    await screen.findByRole('heading', { name: 'Recuperar senha' })

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@opafinance.fake' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar recuperação' }))

    await screen.findByText('Instruções enviadas para o email informado.')
    await screen.findByText('token-teste-123')
    expect(
      screen.getByRole('link', { name: 'Abrir redefinição com token' }),
    ).toBeInTheDocument()
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
