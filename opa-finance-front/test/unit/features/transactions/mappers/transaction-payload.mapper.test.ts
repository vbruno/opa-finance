import { describe, expect, it } from 'vitest'

import {
  buildRecurrencePayloadFromDraft,
  buildTransactionCreatePayloadFromForm,
  buildTransactionUpdatePayloadFromForm,
} from '@/features/transactions/mappers/transaction-payload.mapper'
import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

describe('transaction-payload.mapper', () => {
  const baseFormData: TransactionCreateFormData = {
    accountId: 'acc-1',
    categoryId: 'cat-1',
    subcategoryId: 'sub-1',
    type: 'expense',
    amount: '$ 123,45',
    date: '2026-04-12',
    description: '  Mercado  ',
    notes: '  semanal ',
  }

  it('deve mapear payload de create com trims e parse de valor', () => {
    expect(buildTransactionCreatePayloadFromForm(baseFormData)).toEqual({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      subcategoryId: 'sub-1',
      type: 'expense',
      amount: 123.45,
      date: '2026-04-12',
      description: 'Mercado',
      notes: 'semanal',
    })
  })

  it('deve mapear payload de update com subcategoria nula quando vazio', () => {
    const formData = { ...baseFormData, subcategoryId: '' }
    expect(buildTransactionUpdatePayloadFromForm(formData)).toEqual({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      subcategoryId: null,
      type: 'expense',
      amount: 123.45,
      date: '2026-04-12',
      description: 'Mercado',
      notes: 'semanal',
    })
  })

  it('deve construir recorrencia mensal valida', () => {
    const result = buildRecurrencePayloadFromDraft({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      subcategoryId: 'sub-1',
      amount: 100,
      description: '  Assinatura  ',
      notes: '  mensal ',
      startDate: '2026-04-12',
      frequency: 'monthly',
      endType: 'by_occurrences',
      endOccurrences: '12',
      endDate: '',
      dayOfWeek: '0',
      dayOfMonth: '10',
      monthOfYear: '1',
    })

    expect(result.error).toBeNull()
    expect(result.payload).toEqual({
      originType: 'transaction',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      subcategoryId: 'sub-1',
      amount: 100,
      description: 'Assinatura',
      notes: 'mensal',
      frequency: 'monthly',
      startDate: '2026-04-12',
      endType: 'by_occurrences',
      dayOfMonth: 10,
      endOccurrences: 12,
    })
  })

  it('deve falhar para data inicial invalida', () => {
    const result = buildRecurrencePayloadFromDraft({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      amount: 100,
      startDate: '12/04/2026',
      frequency: 'weekly',
      endType: 'never',
      endOccurrences: '',
      endDate: '',
      dayOfWeek: '0',
      dayOfMonth: '1',
      monthOfYear: '1',
    })

    expect(result.payload).toBeNull()
    expect(result.error).toContain('data inicial')
  })

  it('deve falhar para termino until_date menor que inicio', () => {
    const result = buildRecurrencePayloadFromDraft({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      amount: 100,
      startDate: '2026-04-12',
      frequency: 'yearly',
      endType: 'until_date',
      endOccurrences: '',
      endDate: '2026-04-11',
      dayOfWeek: '1',
      dayOfMonth: '10',
      monthOfYear: '2',
    })

    expect(result.payload).toBeNull()
    expect(result.error).toContain('não pode ser menor')
  })
})
