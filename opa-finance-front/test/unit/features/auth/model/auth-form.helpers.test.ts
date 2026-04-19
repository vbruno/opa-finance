import { describe, expect, it, vi } from 'vitest'

import { setApiRootFormError } from '@/features/auth/model/auth-form.helpers'

describe('auth-form.helpers', () => {
  it('aplica mensagem padrão no erro root quando não há resposta da API', () => {
    const setError = vi.fn()

    setApiRootFormError({
      error: new Error('network'),
      setError,
      defaultMessage: 'Erro padrão',
    })

    expect(setError).toHaveBeenCalledWith('root', { message: 'Erro padrão' })
  })

  it('aplica mensagem de credenciais inválidas para status 401', () => {
    const setError = vi.fn()

    setApiRootFormError({
      error: { response: { status: 401 } },
      setError,
      defaultMessage: 'Erro padrão',
      invalidCredentialsMessage: 'Credenciais inválidas custom',
    })

    expect(setError).toHaveBeenCalledWith('root', {
      message: 'Credenciais inválidas custom',
    })
  })
})
