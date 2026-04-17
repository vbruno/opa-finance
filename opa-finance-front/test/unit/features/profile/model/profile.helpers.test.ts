import { describe, expect, it } from 'vitest'

import {
  buildProfileTimezoneOptionsForSelect,
  filterProfileTimezoneOptions,
  formatProfileCreatedAt,
  resolveProfileTimezoneOptions,
} from '@/features/profile/model/profile.helpers'

describe('profile.helpers', () => {
  it('deve formatar data de cadastro em pt-BR', () => {
    expect(formatProfileCreatedAt('2026-04-18T00:00:00.000Z')).toBe('18/04/2026')
  })

  it('deve manter valor original para data inválida', () => {
    expect(formatProfileCreatedAt('not-a-date')).toBe('not-a-date')
  })

  it('deve priorizar timezones da API quando disponíveis', () => {
    const result = resolveProfileTimezoneOptions({
      apiOptions: ['UTC', 'Australia/Adelaide'],
      localOptions: ['America/Sao_Paulo'],
    })
    expect(result).toEqual(['UTC', 'Australia/Adelaide'])
  })

  it('deve filtrar timezones por busca normalizada', () => {
    const result = filterProfileTimezoneOptions(
      ['America/Sao_Paulo', 'Australia/Adelaide', 'UTC'],
      'sao paulo',
    )
    expect(result).toEqual(['America/Sao_Paulo'])
  })

  it('deve incluir timezone atual no select mesmo fora do filtro', () => {
    const result = buildProfileTimezoneOptionsForSelect({
      filteredOptions: ['UTC'],
      currentTimezone: 'Australia/Adelaide',
    })
    expect(result).toEqual(['Australia/Adelaide', 'UTC'])
  })
})
