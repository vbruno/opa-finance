import { describe, expect, it } from 'vitest'

import {
  mapCreateCategoryPayload,
  mapCreateSubcategoryPayload,
  mapUpdateCategoryPayload,
  mapUpdateSubcategoryPayload,
} from '@/features/categories/mappers/categories-payload.mapper'

describe('categories-payload.mapper', () => {
  it('mapeia payload de criação de categoria', () => {
    const payload = mapCreateCategoryPayload({
      name: 'Mercado',
      type: 'expense',
      description: '  gastos mensais ',
    })

    expect(payload).toEqual({
      name: 'Mercado',
      type: 'expense',
      description: 'gastos mensais',
    })
  })

  it('mapeia payload de edição de categoria', () => {
    const payload = mapUpdateCategoryPayload('cat-1', {
      name: 'Salário',
      description: '   ',
    })

    expect(payload).toEqual({
      id: 'cat-1',
      name: 'Salário',
      description: null,
    })
  })

  it('mapeia payload de criação e edição de subcategoria', () => {
    expect(
      mapCreateSubcategoryPayload('cat-1', {
        categoryId: 'cat-1',
        name: 'Supermercado',
        description: ' compras ',
      }),
    ).toEqual({
      categoryId: 'cat-1',
      name: 'Supermercado',
      description: 'compras',
    })

    expect(
      mapUpdateSubcategoryPayload('sub-1', 'cat-2', {
        name: 'Feira',
        description: '',
      }),
    ).toEqual({
      id: 'sub-1',
      categoryId: 'cat-2',
      name: 'Feira',
      description: null,
    })
  })
})
