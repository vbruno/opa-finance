import { describe, expect, it } from 'vitest'

import {
  buildPaginationItems,
  formatDateDisplay,
  formatDateInput,
  isIsoDate,
  normalizeText,
  parseAmountFilter,
} from '@/features/transactions/model/transactions.helpers'

describe('transactions.helpers', () => {
  describe('parseAmountFilter', () => {
    it('deve parsear valor exato', () => {
      expect(parseAmountFilter('123,45')).toEqual({ amount: 123.45 })
    })

    it('deve parsear faixa com ;', () => {
      expect(parseAmountFilter('200;100')).toEqual({
        amountMin: 100,
        amountMax: 200,
      })
    })

    it('deve parsear comparador', () => {
      expect(parseAmountFilter('>= 99,9')).toEqual({
        amountOp: 'gte',
        amount: 99.9,
      })
    })

    it('deve avaliar expressao aritmetica com precedencia', () => {
      expect(parseAmountFilter('=10+2*3')).toEqual({ amount: 16 })
      expect(parseAmountFilter('=(10+2)')).toEqual({ amount: 12 })
    })

    it('deve retornar null para expressao invalida', () => {
      expect(parseAmountFilter('=10/0')).toBeNull()
      expect(parseAmountFilter('=(10+2')).toBeNull()
      expect(parseAmountFilter('abc')).toBeNull()
    })
  })

  describe('buildPaginationItems', () => {
    it('deve retornar pagina unica quando total <= 1', () => {
      expect(buildPaginationItems(1, 1)).toEqual([1])
      expect(buildPaginationItems(1, 0)).toEqual([1])
    })

    it('deve montar elipses para paginas intermediarias', () => {
      expect(buildPaginationItems(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10])
    })

    it('deve evitar elipse perto do inicio/fim', () => {
      expect(buildPaginationItems(2, 5)).toEqual([1, 2, 3, '...', 5])
      expect(buildPaginationItems(4, 5)).toEqual([1, '...', 3, 4, 5])
    })
  })

  describe('date/text helpers', () => {
    const formatter = new Intl.DateTimeFormat('pt-BR')

    it('deve formatar data valida e retornar - para invalida', () => {
      expect(formatDateDisplay('2026-04-12', formatter)).toBe('12/04/2026')
      expect(formatDateDisplay('data-invalida', formatter)).toBe('-')
      expect(formatDateDisplay(null, formatter)).toBe('-')
    })

    it('deve formatar date input em yyyy-mm-dd', () => {
      expect(formatDateInput(new Date('2026-04-12T10:00:00Z'))).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      )
    })

    it('deve validar ISO date simples e normalizar texto acentuado', () => {
      expect(isIsoDate('2026-04-12')).toBe(true)
      expect(isIsoDate('12/04/2026')).toBe(false)
      expect(normalizeText('Árvore ÇÃO')).toBe('arvore cao')
    })
  })
})
