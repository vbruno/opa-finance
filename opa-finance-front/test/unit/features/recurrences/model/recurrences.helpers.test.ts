import { describe, expect, it, vi } from 'vitest'

import {
  buildScopedRecurrenceUpdatePayload,
  compareIsoDate,
  formatIsoDateToPtBr,
  formatRecurrenceFrequency,
  formatRecurrenceOriginType,
  formatRecurrenceStatus,
  getRecurrenceConfirmErrorMessage,
  toRecurrenceCreatePayload,
  toScopedRecurrenceUpdatePayload,
} from '@/features/recurrences/model/recurrences.helpers'
import type { Recurrence } from '@/features/recurrences'
import type { RecurrenceFormData } from '@/schemas/recurrence.schema'

vi.mock('@/features/auth', () => ({
  getUser: () => null,
}))

function makeRecurrence(partial: Partial<Recurrence> = {}): Recurrence {
  return {
    id: 'rec-1',
    userId: 'user-1',
    originType: 'transaction',
    status: 'active',
    postingMode: 'automatic',
    timezone: 'Australia/Adelaide',
    frequency: 'monthly',
    startDate: '2026-04-01',
    dayOfWeek: null,
    dayOfMonth: 1,
    monthOfYear: null,
    endType: 'never',
    endOccurrences: null,
    endDate: null,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    subcategoryId: 'sub-1',
    fromAccountId: null,
    toAccountId: null,
    amount: 120,
    description: 'Academia',
    notes: null,
    nextOccurrenceDate: '2026-05-01',
    lastMaterializedDate: null,
    lastMaterializedAt: null,
    finalizedAt: null,
    deletedAt: null,
    version: 3,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...partial,
  }
}

function makeForm(partial: Partial<RecurrenceFormData> = {}): RecurrenceFormData {
  return {
    originType: 'transaction',
    postingMode: 'automatic',
    frequency: 'monthly',
    startDate: '2026-04-01',
    dayOfWeek: '',
    dayOfMonth: '1',
    monthOfYear: '',
    endType: 'never',
    endOccurrences: '',
    endDate: '',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    subcategoryId: 'sub-1',
    fromAccountId: '',
    toAccountId: '',
    amount: '120,00',
    description: 'Academia',
    notes: '',
    editScope: 'all',
    occurrenceDate: '2026-05-01',
    ...partial,
  }
}

describe('recurrences.helpers', () => {
  it('deve mapear labels de origem/frequência/status', () => {
    expect(formatRecurrenceOriginType('transaction')).toBe('Transação')
    expect(formatRecurrenceFrequency('biweekly')).toBe('Quinzenal')
    expect(formatRecurrenceStatus('finalized')).toBe('Finalizada')
  })

  it('deve formatar data ISO e comparar datas ISO', () => {
    expect(formatIsoDateToPtBr('2026-04-17')).toBe('17/04/2026')
    expect(compareIsoDate('2026-04-17', '2026-04-17')).toBe(0)
    expect(compareIsoDate('2026-04-16', '2026-04-17')).toBe(-1)
    expect(compareIsoDate('2026-04-18', '2026-04-17')).toBe(1)
  })

  it('deve gerar payload de criação para transação', () => {
    const payload = toRecurrenceCreatePayload(makeForm())
    expect(payload.originType).toBe('transaction')
    expect(payload.postingMode).toBe('automatic')
    expect(payload.amount).toBe(120)
  })

  it('deve remover campos de agenda no escopo single no payload de update', () => {
    const diff = buildScopedRecurrenceUpdatePayload(
      makeForm({
        editScope: 'single',
        postingMode: 'review_required',
        amount: '150,00',
        frequency: 'weekly',
        dayOfWeek: '1',
        dayOfMonth: '',
      }),
      makeRecurrence(),
    )

    expect(diff.amount).toBe(150)
    expect(diff.postingMode).toBeUndefined()
    expect(diff.frequency).toBeUndefined()
    expect(diff.dayOfWeek).toBeUndefined()
  })

  it('deve incluir modo de lançamento no update global', () => {
    const diff = buildScopedRecurrenceUpdatePayload(
      makeForm({
        editScope: 'all',
        postingMode: 'review_required',
      }),
      makeRecurrence(),
    )

    expect(diff.postingMode).toBe('review_required')
  })

  it('deve montar snapshot completo para edição global', () => {
    const payload = toScopedRecurrenceUpdatePayload(
      makeForm({
        editScope: 'all',
        endType: 'by_occurrences',
        endOccurrences: '5',
        description: 'Academia 1.6',
      }),
    )

    expect(payload).toMatchObject({
      postingMode: 'automatic',
      frequency: 'monthly',
      startDate: '2026-04-01',
      dayOfMonth: 1,
      endType: 'by_occurrences',
      endOccurrences: 5,
      description: 'Academia 1.6',
    })
  })

  it('deve omitir limpezas nulas quando o campo opcional não mudou', () => {
    const payload = toScopedRecurrenceUpdatePayload(
      makeForm({
        editScope: 'all',
        notes: '',
      }),
      {
        description: 'Academia 1.6',
      },
    )

    expect(payload.notes).toBeUndefined()
  })

  it('deve manter limpeza nula quando o campo opcional foi alterado', () => {
    const payload = toScopedRecurrenceUpdatePayload(
      makeForm({
        editScope: 'all',
        notes: '',
      }),
      {
        notes: null,
      },
    )

    expect(payload.notes).toBeNull()
  })

  it('deve montar snapshot de nova regra sem startDate para this_and_next', () => {
    const payload = toScopedRecurrenceUpdatePayload(
      makeForm({
        editScope: 'this_and_next',
        endType: 'by_occurrences',
        endOccurrences: '5',
      }),
    )

    expect(payload.startDate).toBeUndefined()
    expect(payload.endType).toBe('by_occurrences')
    expect(payload.endOccurrences).toBe(5)
  })

  it('deve montar snapshot de negócio sem agenda para single', () => {
    const payload = toScopedRecurrenceUpdatePayload(
      makeForm({
        editScope: 'single',
        endType: 'by_occurrences',
        endOccurrences: '5',
      }),
    )

    expect(payload.frequency).toBeUndefined()
    expect(payload.endType).toBeUndefined()
    expect(payload.endOccurrences).toBeUndefined()
    expect(payload.amount).toBe(120)
    expect(payload.accountId).toBe('acc-1')
  })

  it('deve traduzir erro 422 do confirm quando a data ajustada estiver fora do range', () => {
    const message = getRecurrenceConfirmErrorMessage({
      response: {
        status: 422,
        data: {
          detail: 'A data ajustada deve estar entre 01/05/2026 e 30/04/2027.',
        },
      },
    })

    expect(message).toBe('A data ajustada deve estar entre 01/05/2026 e 30/04/2027.')
  })

  it('deve usar fallback claro para 422 sem detalhe específico', () => {
    const message = getRecurrenceConfirmErrorMessage({
      response: {
        status: 422,
        data: {
          detail: 'O occurrenceDate está fora do range permitido.',
        },
      },
    })

    expect(message).toBe(
      'A data ajustada precisa ficar dentro do intervalo permitido para esta confirmação.',
    )
  })
})
