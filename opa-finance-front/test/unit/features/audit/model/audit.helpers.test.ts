import { describe, expect, it } from 'vitest'

import {
  actionLabel,
  looksLikeUuid,
  normalizeAuditString,
  normalizePreviewData,
  screenLabel,
} from '@/features/audit/model/audit.helpers'

describe('audit.helpers', () => {
  it('deve mapear labels de ação e tela', () => {
    expect(actionLabel('create')).toBe('Criação')
    expect(screenLabel('transaction')).toBe('Transações')
  })

  it('deve normalizar strings e detectar uuid', () => {
    expect(normalizeAuditString('  teste  ')).toBe('teste')
    expect(normalizeAuditString('   ')).toBeNull()
    expect(looksLikeUuid('295bf2db-2d25-4367-a289-f2d98f03057c')).toBe(true)
  })

  it('deve normalizar dados de preview', () => {
    expect(normalizePreviewData(null)).toEqual([])
    expect(normalizePreviewData({ a: 1, b: true, c: null })).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: 'true' },
      { key: 'c', value: '-' },
    ])
  })
})
