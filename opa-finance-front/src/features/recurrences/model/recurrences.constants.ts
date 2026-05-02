import type {
  Recurrence,
  RecurrenceTimelineItem,
} from '@/features/recurrences'

export const RECURRENCE_ORIGIN_TYPES = ['transaction', 'transfer'] as const
export const RECURRENCE_POSTING_MODES = ['automatic', 'review_required'] as const
export const RECURRENCE_STATUSES = ['active', 'finalized'] as const
export const RECURRENCE_FREQUENCIES = [
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
] as const

export const RECURRENCE_DAY_OF_WEEK_OPTIONS = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terça' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sábado' },
] as const

export const RECURRENCE_MONTH_OPTIONS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
] as const

export const RECURRENCE_ORIGIN_LABELS: Record<
  (typeof RECURRENCE_ORIGIN_TYPES)[number],
  string
> = {
  transaction: 'Transação',
  transfer: 'Transferência',
}

export const RECURRENCE_FREQUENCY_LABELS: Record<
  (typeof RECURRENCE_FREQUENCIES)[number],
  string
> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  yearly: 'Anual',
}

export const RECURRENCE_POSTING_MODE_LABELS: Record<
  (typeof RECURRENCE_POSTING_MODES)[number],
  string
> = {
  automatic: 'Automático',
  review_required: 'Com revisão',
}

export const RECURRENCE_STATUS_LABELS: Record<
  (typeof RECURRENCE_STATUSES)[number],
  string
> = {
  active: 'Em execução',
  finalized: 'Finalizada',
}

export const RECURRENCE_TIMELINE_STATUSES = [
  'materialized',
  'pending_review',
  'skipped',
  'failed',
  'projected',
] as const

export const RECURRENCE_TIMELINE_STATUS_LABELS: Record<
  (typeof RECURRENCE_TIMELINE_STATUSES)[number],
  string
> = {
  materialized: 'Lançada',
  pending_review: 'Pendente de revisão',
  skipped: 'Ignorada',
  failed: 'Falhou',
  projected: 'Projetada',
}

export const RECURRENCE_TIMELINE_SOURCE_LABELS: Record<
  RecurrenceTimelineItem['source'],
  string
> = {
  persisted: 'Persistida',
  projected: 'Projetada',
}

export type RecurrenceFilters = {
  originType: Recurrence['originType']
  status: Recurrence['status']
  frequency: Recurrence['frequency']
  postingMode?: Recurrence['postingMode']
}

export type RecurrenceAction = 'create' | 'edit' | 'finalize' | 'delete'
