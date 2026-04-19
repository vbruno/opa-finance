import { describe, expect, it } from 'vitest'

import { getApiErrorMessage, getApiErrorStatus } from '@/lib/apiError'

describe('apiError', () => {
  it('extrai status de erro com segurança', () => {
    expect(getApiErrorStatus({ response: { status: 409 } })).toBe(409)
    expect(getApiErrorStatus({})).toBeUndefined()
    expect(getApiErrorStatus(null)).toBeUndefined()
  })

  it('retorna mensagem de fallback quando erro não tem formato de API', () => {
    expect(
      getApiErrorMessage(new Error('network'), {
        defaultMessage: 'Erro padrão',
      }),
    ).toBe('Erro padrão')
  })
})
