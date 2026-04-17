import { describe, expect, it } from 'vitest'

import {
  buildUpdateProfilePayload,
  toProfileFormValues,
} from '@/features/profile/mappers/profile.mapper'
import { PROFILE_DEFAULT_TIMEZONE } from '@/features/profile/model/profile.constants'

describe('profile.mapper', () => {
  it('deve montar payload de update de perfil', () => {
    const result = buildUpdateProfilePayload({
      userId: 'user-1',
      values: {
        name: 'Bruno',
        timezone: 'Australia/Adelaide',
      },
    })

    expect(result).toEqual({
      id: 'user-1',
      name: 'Bruno',
      timezone: 'Australia/Adelaide',
    })
  })

  it('deve montar default values com fallback de timezone', () => {
    const result = toProfileFormValues(null)
    expect(result).toEqual({
      name: '',
      timezone: PROFILE_DEFAULT_TIMEZONE,
    })
  })
})
