import { describe, expect, it, vi } from 'vitest'

import { setFormApiError, setFormApiRootError } from '@/lib/form-api-error'

describe('form-api-error', () => {
  it('aplica erro root com mensagem de fallback', () => {
    const setError = vi.fn()

    setFormApiRootError({
      error: new Error('network'),
      setError,
      options: { defaultMessage: 'Erro padrão' },
    })

    expect(setError).toHaveBeenCalledWith('root', { message: 'Erro padrão' })
  })

  it('aplica erro em campo específico', () => {
    const setError = vi.fn()

    setFormApiError({
      error: { response: { status: 400, data: { detail: 'Campo inválido' } } },
      setError,
      fieldPath: 'email',
      options: { defaultMessage: 'Erro padrão' },
    })

    expect(setError).toHaveBeenCalledWith('email', {
      message: 'Campo inválido',
    })
  })
})
