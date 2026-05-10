import { describe, expect, it, vi } from 'vitest'

import {
  addOneYearIsoDate,
  buildScopedRecurrenceUpdatePayload,
  compareIsoDate,
  formatIsoDateToPtBr,
  formatRecurrenceFrequency,
  formatRecurrenceOriginType,
  formatRecurrenceStatus,
  getRecurrenceOperationalEndDate,
  getRecurrenceConfirmErrorMessage,
  toRecurrenceCreatePayload,
  toRecurrenceUpdatePayload,
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
    hasConsumedOccurrences: false,
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

  describe('addOneYearIsoDate', () => {
    it('deve adicionar 1 ano preservando mês e dia', () => {
      expect(addOneYearIsoDate('2026-05-06')).toBe('2027-05-06')
    })

    it('deve ajustar 29/02 para o último dia válido do ano seguinte', () => {
      expect(addOneYearIsoDate('2024-02-29')).toBe('2025-02-28')
    })

    it('deve manter 28/02 ao avançar para ano bissexto', () => {
      expect(addOneYearIsoDate('2023-02-28')).toBe('2024-02-28')
    })

    it('deve preservar 31/12 na virada de ano', () => {
      expect(addOneYearIsoDate('2026-12-31')).toBe('2027-12-31')
    })

    it('deve preservar 31/01 no início de ano', () => {
      expect(addOneYearIsoDate('2026-01-31')).toBe('2027-01-31')
    })
  })

  it('deve calcular horizonte operacional de 1 ano para recorrência sem fim', () => {
    expect(addOneYearIsoDate('2026-05-06')).toBe('2027-05-06')
    expect(addOneYearIsoDate('2024-02-29')).toBe('2025-02-28')
    expect(getRecurrenceOperationalEndDate(makeRecurrence({
      endType: 'never',
      startDate: '2026-05-06',
    }))).toBe('2027-05-06')
  })

  it('deve usar data final como horizonte operacional quando término for por data final', () => {
    expect(getRecurrenceOperationalEndDate(makeRecurrence({
      endType: 'until_date',
      endDate: '2026-12-31',
    }))).toBe('2026-12-31')
  })

  it('não deve calcular horizonte operacional no front para término por ocorrências', () => {
    expect(getRecurrenceOperationalEndDate(makeRecurrence({
      endType: 'by_occurrences',
      endOccurrences: 5,
    }))).toBeNull()
  })

  it('deve gerar payload de criação para transação', () => {
    const payload = toRecurrenceCreatePayload(makeForm())
    expect(payload.originType).toBe('transaction')
    expect(payload.postingMode).toBe('automatic')
    expect(payload.amount).toBe(120)
  })

  it('deve gerar payload de criação por data final', () => {
    const payload = toRecurrenceCreatePayload(
      makeForm({
        endType: 'until_date',
        endOccurrences: '5',
        endDate: '2026-12-31',
      }),
    )

    expect(payload).toMatchObject({
      endType: 'until_date',
      endDate: '2026-12-31',
    })
    expect(payload.endOccurrences).toBeUndefined()
  })

  it('toRecurrenceCreatePayload lança erro quando accountId está vazio em transação', () => {
    expect(() => toRecurrenceCreatePayload(makeForm({ accountId: '' }))).toThrow(
      'Conta é obrigatória.',
    )
  })

  it('toRecurrenceCreatePayload lança erro quando categoryId está vazio em transação', () => {
    expect(() => toRecurrenceCreatePayload(makeForm({ categoryId: '' }))).toThrow(
      'Categoria é obrigatória.',
    )
  })

  it('toRecurrenceCreatePayload lança erro quando fromAccountId está vazio em transferência', () => {
    expect(() =>
      toRecurrenceCreatePayload(
        makeForm({
          originType: 'transfer',
          fromAccountId: '',
          toAccountId: 'acc-2',
        }),
      ),
    ).toThrow('Conta de origem é obrigatória.')
  })

  it('toRecurrenceCreatePayload lança erro quando toAccountId está vazio em transferência', () => {
    expect(() =>
      toRecurrenceCreatePayload(
        makeForm({
          originType: 'transfer',
          fromAccountId: 'acc-1',
          toAccountId: '',
        }),
      ),
    ).toThrow('Conta de destino é obrigatória.')
  })

  it('toRecurrenceUpdatePayload lança erro quando accountId está vazio em transação', () => {
    expect(() => toRecurrenceUpdatePayload(makeForm({ accountId: '' }))).toThrow(
      'Conta é obrigatória.',
    )
  })

  it('toRecurrenceUpdatePayload lança erro quando categoryId está vazio em transação', () => {
    expect(() => toRecurrenceUpdatePayload(makeForm({ categoryId: '' }))).toThrow(
      'Categoria é obrigatória.',
    )
  })

  it('toRecurrenceUpdatePayload lança erro quando fromAccountId está vazio em transferência', () => {
    expect(() =>
      toRecurrenceUpdatePayload(
        makeForm({
          originType: 'transfer',
          fromAccountId: '',
          toAccountId: 'acc-2',
        }),
      ),
    ).toThrow('Conta de origem é obrigatória.')
  })

  it('toRecurrenceUpdatePayload lança erro quando toAccountId está vazio em transferência', () => {
    expect(() =>
      toRecurrenceUpdatePayload(
        makeForm({
          originType: 'transfer',
          fromAccountId: 'acc-1',
          toAccountId: '',
        }),
      ),
    ).toThrow('Conta de destino é obrigatória.')
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

  it('deve montar snapshot de troca de término por ocorrências para data final', () => {
    const payload = toScopedRecurrenceUpdatePayload(
      makeForm({
        editScope: 'all',
        endType: 'until_date',
        endOccurrences: '5',
        endDate: '2026-12-31',
      }),
    )

    expect(payload).toMatchObject({
      endType: 'until_date',
      endDate: '2026-12-31',
    })
    expect(payload.endOccurrences).toBeUndefined()
  })

  it('deve detectar troca de término por ocorrências para data final', () => {
    const diff = buildScopedRecurrenceUpdatePayload(
      makeForm({
        editScope: 'all',
        endType: 'until_date',
        endOccurrences: '5',
        endDate: '2026-12-31',
      }),
      makeRecurrence({
        endType: 'by_occurrences',
        endOccurrences: 5,
        endDate: null,
      }),
    )

    expect(diff.endType).toBe('until_date')
    expect(diff.endDate).toBe('2026-12-31')
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
