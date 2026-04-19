import { describe, expect, it, vi } from 'vitest'

import {
  isAuthFormPending,
  setApiRootFormError,
  submitWithApiRootError,
} from '@/features/auth/model/auth-form.helpers'

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

  it('resolve estado pending do formulário', () => {
    expect(isAuthFormPending(false, false)).toBe(false)
    expect(isAuthFormPending(true, false)).toBe(true)
    expect(isAuthFormPending(false, true)).toBe(true)
  })

  it('executa submit com sucesso e callback onSuccess', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true })
    const onSuccess = vi.fn()
    const clearRootError = vi.fn()

    await submitWithApiRootError({
      payload: { email: 'demo@demo.com' },
      execute,
      setError: vi.fn(),
      clearRootError,
      defaultMessage: 'Erro padrão',
      onSuccess,
    })

    expect(clearRootError).toHaveBeenCalled()
    expect(execute).toHaveBeenCalledWith({ email: 'demo@demo.com' })
    expect(onSuccess).toHaveBeenCalledWith({ ok: true })
  })

  it('aplica erro root quando submit falha', async () => {
    const setError = vi.fn()

    await submitWithApiRootError({
      payload: { email: 'demo@demo.com' },
      execute: vi.fn().mockRejectedValue(new Error('fail')),
      setError,
      defaultMessage: 'Erro padrão',
    })

    expect(setError).toHaveBeenCalledWith('root', { message: 'Erro padrão' })
  })
})
