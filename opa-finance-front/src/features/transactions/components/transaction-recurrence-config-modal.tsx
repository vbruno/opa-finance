import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'

import { TransactionRecurrenceScheduleFields } from './transaction-recurrence-schedule-fields'

type TransactionRecurrenceConfigModalProps = {
  // Campos de configuração
  startDate: string
  onStartDateChange: (value: string) => void
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  onFrequencyChange: (value: 'weekly' | 'biweekly' | 'monthly' | 'yearly') => void
  dayOfMonth: string
  onDayOfMonthChange: (value: string) => void
  monthOfYear: string
  onMonthOfYearChange: (value: string) => void
  endType: 'never' | 'by_occurrences' | 'until_date'
  onEndTypeChange: (value: 'never' | 'by_occurrences' | 'until_date') => void
  endOccurrences: string
  onEndOccurrencesChange: (value: string) => void
  endDate: string
  onEndDateChange: (value: string) => void

  // Controle
  onClose: () => void
  onConfirm: () => void
}

export function TransactionRecurrenceConfigModal(
  props: TransactionRecurrenceConfigModalProps,
) {
  const {
    startDate,
    onStartDateChange,
    frequency,
    onFrequencyChange,
    dayOfMonth,
    onDayOfMonthChange,
    monthOfYear,
    onMonthOfYearChange,
    endType,
    onEndTypeChange,
    endOccurrences,
    onEndOccurrencesChange,
    endDate,
    onEndDateChange,
    onClose,
    onConfirm,
  } = props

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    modalRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 z-[70]" onClick={onClose} />
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurrence-config-title"
        className="relative z-[70] w-full max-w-2xl rounded-lg border bg-background shadow-lg p-4 sm:p-6"
      >
        <div className="flex items-center justify-between gap-2 mb-6">
          <h3 id="recurrence-config-title" className="text-lg font-semibold">
            Configurar recorrência
          </h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        <TransactionRecurrenceScheduleFields
          startDate={startDate}
          onStartDateChange={onStartDateChange}
          frequency={frequency}
          onFrequencyChange={onFrequencyChange}
          dayOfMonth={dayOfMonth}
          onDayOfMonthChange={onDayOfMonthChange}
          monthOfYear={monthOfYear}
          onMonthOfYearChange={onMonthOfYearChange}
          endType={endType}
          onEndTypeChange={onEndTypeChange}
          endOccurrences={endOccurrences}
          onEndOccurrencesChange={onEndOccurrencesChange}
          endDate={endDate}
          onEndDateChange={onEndDateChange}
        />

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  )
}
