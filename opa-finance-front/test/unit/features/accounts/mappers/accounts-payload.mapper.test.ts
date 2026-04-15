import { describe, expect, it } from 'vitest'

import {
  mapCreateAccountPayload,
  mapUpdateAccountPayload,
} from '@/features/accounts/mappers/accounts-payload.mapper'

describe('accounts-payload.mapper', () => {
  it('mapeia payload de criação', () => {
    const payload = mapCreateAccountPayload({
      name: 'Conta nova',
      type: 'checking_account',
      confirm: true,
    })

    expect(payload).toEqual({
      name: 'Conta nova',
      type: 'checking_account',
    })
  })

  it('mapeia payload de edição', () => {
    const payload = mapUpdateAccountPayload({
      name: 'Conta editada',
      type: 'savings_account',
      confirm: true,
    })

    expect(payload).toEqual({
      name: 'Conta editada',
      type: 'savings_account',
    })
  })
})
