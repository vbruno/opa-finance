import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_TYPE_VALUES,
  isAccountType,
  isAccountsSortDirection,
  isAccountsSortKey,
} from '@/features/accounts/model/accounts.constants'

describe('accounts.constants', () => {
  it('mantém catálogo de tipos de conta consistente', () => {
    expect(ACCOUNT_TYPE_VALUES).toContain('checking_account')
    expect(ACCOUNT_TYPE_OPTIONS.length).toBe(ACCOUNT_TYPE_VALUES.length)
    expect(ACCOUNT_TYPE_OPTIONS[0]).toHaveProperty('label')
  })

  it('valida type/sort/dir corretamente', () => {
    expect(isAccountType('credit_card')).toBe(true)
    expect(isAccountType('other')).toBe(false)
    expect(isAccountsSortKey('balance')).toBe(true)
    expect(isAccountsSortKey('createdAt')).toBe(false)
    expect(isAccountsSortDirection('asc')).toBe(true)
    expect(isAccountsSortDirection('up')).toBe(false)
  })
})
