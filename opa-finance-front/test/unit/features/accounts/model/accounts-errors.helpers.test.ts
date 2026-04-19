import { describe, expect, it } from 'vitest'

import {
  resolveAccountDeleteErrorFeedback,
} from '@/features/accounts/model/accounts-errors.helpers'

describe('accounts-errors.helpers', () => {
  it('resolve feedback de exclusão para conflito (409)', () => {
    expect(
      resolveAccountDeleteErrorFeedback({
        status: 409,
        message: 'Conta bloqueada.',
        isRecurrenceConflict: false,
      }),
    ).toEqual({
      deleteError: null,
      deleteBlockedReason: 'Conta bloqueada.',
    })
  })

  it('resolve feedback de recorrência ativa com texto complementar', () => {
    expect(
      resolveAccountDeleteErrorFeedback({
        status: 409,
        message: 'Conta com recorrência ativa vinculada.',
        isRecurrenceConflict: true,
      }),
    ).toEqual({
      deleteError: null,
      deleteBlockedReason:
        'Conta com recorrência ativa vinculada. Finalize ou remapeie as recorrências antes de excluir a conta.',
    })
  })

  it('resolve feedback padrão fora de 409', () => {
    expect(
      resolveAccountDeleteErrorFeedback({
        status: 500,
        message: 'Erro interno.',
        isRecurrenceConflict: false,
      }),
    ).toEqual({
      deleteError: 'Erro interno.',
      deleteBlockedReason: null,
    })
  })
})
