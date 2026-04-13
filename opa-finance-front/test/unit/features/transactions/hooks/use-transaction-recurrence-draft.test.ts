import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useTransactionRecurrenceDraft } from '@/features/transactions'

describe('useTransactionRecurrenceDraft', () => {
  it('deve resetar draft com base na data informada', () => {
    const { result } = renderHook(() =>
      useTransactionRecurrenceDraft({ createDate: '2026-04-13' }),
    )

    act(() => {
      result.current.resetCreateRecurrenceDraft('2026-03-10')
    })

    expect(result.current.createRecurrenceStartDate).toBe('2026-03-10')
    expect(result.current.createRecurrenceFrequency).toBe('monthly')
    expect(result.current.createRecurrenceEndType).toBe('never')
    expect(result.current.createRecurrenceDayOfMonth).toBe('10')
  })

  it('deve sincronizar startDate com createDate quando recorrência está ativa e sem toque manual', () => {
    const { result, rerender } = renderHook(
      ({ createDate }) => useTransactionRecurrenceDraft({ createDate }),
      { initialProps: { createDate: '2026-04-13' } },
    )

    act(() => {
      result.current.setIsCreateRecurrenceEnabled(true)
    })

    rerender({ createDate: '2026-04-25' })

    expect(result.current.createRecurrenceStartDate).toBe('2026-04-25')
  })
})
