import { describe, expect, it } from 'vitest'

import {
  arraysEqual,
  isRecurrenceConflictMessage,
  normalizeOptionalDescription,
  normalizeSearch,
  sortUserCategories,
} from '@/features/categories/model/categories.helpers'

describe('categories.helpers', () => {
  it('normaliza busca removendo acentos e caixa', () => {
    expect(normalizeSearch('  ReCorrênCia  ')).toBe('recorrencia')
  })

  it('normaliza descrição opcional', () => {
    expect(normalizeOptionalDescription('  teste  ')).toBe('teste')
    expect(normalizeOptionalDescription('   ')).toBeNull()
    expect(normalizeOptionalDescription(undefined)).toBeNull()
  })

  it('detecta conflito de recorrência por mensagem', () => {
    expect(
      isRecurrenceConflictMessage('Categoria com recorrência ativa vinculada'),
    ).toBe(true)
    expect(isRecurrenceConflictMessage('Erro genérico')).toBe(false)
  })

  it('compara arrays por conteúdo e ordem', () => {
    expect(arraysEqual(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(arraysEqual(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('ordena categorias por tipo e nome', () => {
    const sorted = sortUserCategories([
      {
        id: '1',
        name: 'Mercado',
        type: 'expense',
      },
      {
        id: '2',
        name: 'Salário',
        type: 'income',
      },
      {
        id: '3',
        name: 'Bonus',
        type: 'income',
      },
    ] as never)

    expect(sorted.map((item) => item.id)).toEqual(['3', '2', '1'])
  })
})
