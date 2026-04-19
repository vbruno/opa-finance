import { describe, expect, it } from 'vitest'

import {
  buildCategoryTreeOptions,
  buildDescriptionSuggestions,
  resolveDefaultTransferToAccountId,
} from '@/features/transactions/model/transactions-page.helpers'

describe('transactions-page.helpers', () => {
  describe('resolveDefaultTransferToAccountId', () => {
    it('retorna vazio quando não há conta principal ou só existe uma conta', () => {
      expect(resolveDefaultTransferToAccountId([], '')).toBe('')
      expect(
        resolveDefaultTransferToAccountId(
          [
            {
              id: 'a-1',
              name: 'Principal',
              type: 'checking_account',
              currentBalance: 100,
              isPrimary: true,
              isHiddenOnDashboard: false,
              createdAt: '',
              updatedAt: '',
            },
          ],
          'a-1',
        ),
      ).toBe('')
    })

    it('retorna a próxima conta disponível após a principal', () => {
      const result = resolveDefaultTransferToAccountId(
        [
          {
            id: 'a-1',
            name: 'Principal',
            type: 'checking_account',
            currentBalance: 100,
            isPrimary: true,
            isHiddenOnDashboard: false,
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 'a-2',
            name: 'Destino',
            type: 'savings_account',
            currentBalance: 50,
            isPrimary: false,
            isHiddenOnDashboard: false,
            createdAt: '',
            updatedAt: '',
          },
        ],
        'a-1',
      )

      expect(result).toBe('a-2')
    })

    it('faz wrap para buscar conta antes da principal', () => {
      const result = resolveDefaultTransferToAccountId(
        [
          {
            id: 'a-1',
            name: 'Conta 1',
            type: 'checking_account',
            currentBalance: 100,
            isPrimary: false,
            isHiddenOnDashboard: false,
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 'a-2',
            name: 'Principal',
            type: 'savings_account',
            currentBalance: 50,
            isPrimary: true,
            isHiddenOnDashboard: false,
            createdAt: '',
            updatedAt: '',
          },
        ],
        'a-2',
      )

      expect(result).toBe('a-1')
    })
  })

  describe('buildCategoryTreeOptions', () => {
    const categories = [
      {
        id: 'c-1',
        userId: 'u-1',
        name: 'Habitação',
        description: null,
        type: 'expense' as const,
        system: false,
        color: null,
        createdAt: '',
        updatedAt: '',
      },
    ]

    const subcategoriesByCategory = {
      'c-1': [
        {
          id: 's-1',
          userId: 'u-1',
          categoryId: 'c-1',
          name: 'Aluguel',
          description: null,
          color: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
    }

    it('retorna categoria e subcategoria quando não há busca', () => {
      expect(
        buildCategoryTreeOptions({
          categories,
          subcategoriesByCategory,
          search: '',
        }),
      ).toEqual([
        { value: 'category:c-1', label: 'Habitação', level: 'category' },
        {
          value: 'subcategory:c-1:s-1',
          label: 'Aluguel · Habitação',
          level: 'subcategory',
        },
      ])
    })

    it('filtra por busca ignorando acentos', () => {
      expect(
        buildCategoryTreeOptions({
          categories,
          subcategoriesByCategory,
          search: 'aluguel',
        }),
      ).toEqual([
        { value: 'category:c-1', label: 'Habitação', level: 'category' },
        {
          value: 'subcategory:c-1:s-1',
          label: 'Aluguel · Habitação',
          level: 'subcategory',
        },
      ])
    })
  })

  describe('buildDescriptionSuggestions', () => {
    it('usa base quando não deve filtrar', () => {
      const result = buildDescriptionSuggestions({
        baseItems: ['Mercado', 'Farmácia'],
        filteredItems: ['Ignorado'],
        shouldFilter: false,
        queryText: '',
      })

      expect(result).toEqual(['Mercado', 'Farmácia'])
    })

    it('prioriza lista filtrada quando disponível', () => {
      const result = buildDescriptionSuggestions({
        baseItems: ['Mercado', 'Farmácia'],
        filteredItems: ['Mercado Extra'],
        shouldFilter: true,
        queryText: 'merc',
      })

      expect(result).toEqual(['Mercado Extra'])
    })

    it('faz fallback para filtro local quando lista filtrada vem vazia', () => {
      const result = buildDescriptionSuggestions({
        baseItems: ['Mercado', 'Farmácia', 'Combustível'],
        filteredItems: [],
        shouldFilter: true,
        queryText: 'combus',
      })

      expect(result).toEqual(['Combustível'])
    })
  })
})
