import type { Category } from '@/features/categories'
import type {
  Recurrence,
  RecurrenceCreatePayload,
  RecurrencePostingMode,
  RecurrenceTimelineItem,
  RecurrenceUpdatePayload,
} from '@/features/recurrences'
import {
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_ORIGIN_LABELS,
  RECURRENCE_STATUS_LABELS,
  RECURRENCE_TIMELINE_SOURCE_LABELS,
  RECURRENCE_TIMELINE_STATUS_LABELS,
} from '@/features/recurrences/model/recurrences.constants'
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/apiError'
import { formatCurrencyValue, parseCurrencyInput } from '@/lib/utils'
import type { RecurrenceFormData } from '@/schemas/recurrence.schema'

export function getDayOfWeekFromIsoDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return ''

  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) return ''

  return String(date.getUTCDay())
}

function getValidatedPostingMode(
  value: RecurrenceFormData['postingMode'],
): RecurrencePostingMode {
  if (value === 'automatic' || value === 'review_required') {
    return value
  }

  throw new Error('Selecione o modo de lançamento.')
}

function getValidatedDescription(value: string | undefined) {
  const description = value?.trim() ?? ''
  if (description.length === 0) {
    throw new Error('Informe a descrição.')
  }
  return description
}

export function getDefaultRecurrenceFormValues(
  userTimezone?: string | null,
): RecurrenceFormData {
  const startDate = getTodayIsoDateInTimezone(userTimezone)

  return {
    originType: 'transaction',
    postingMode: '' as RecurrenceFormData['postingMode'],
    frequency: 'weekly',
    startDate,
    dayOfWeek: getDayOfWeekFromIsoDate(startDate),
    dayOfMonth: '',
    monthOfYear: '',
    endType: 'never',
    endOccurrences: '',
    endDate: '',
    accountId: '',
    categoryId: '',
    subcategoryId: '',
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    description: '',
    notes: '',
    editScope: 'all',
    occurrenceDate: '',
  }
}

export function getRecurrenceFormValuesFromEntity(
  recurrence: Recurrence,
): RecurrenceFormData {
  return {
    originType: recurrence.originType,
    postingMode: recurrence.postingMode,
    frequency: recurrence.frequency,
    startDate: recurrence.startDate,
    dayOfWeek: recurrence.dayOfWeek?.toString() ?? '',
    dayOfMonth: recurrence.dayOfMonth?.toString() ?? '',
    monthOfYear: recurrence.monthOfYear?.toString() ?? '',
    endType: recurrence.endType,
    endOccurrences: recurrence.endOccurrences?.toString() ?? '',
    endDate: recurrence.endDate ?? '',
    accountId: recurrence.accountId ?? '',
    categoryId: recurrence.categoryId ?? '',
    subcategoryId: recurrence.subcategoryId ?? '',
    fromAccountId: recurrence.fromAccountId ?? '',
    toAccountId: recurrence.toAccountId ?? '',
    amount: `$ ${formatCurrencyValue(recurrence.amount)}`,
    description: recurrence.description ?? '',
    notes: recurrence.notes ?? '',
    editScope: 'all',
    occurrenceDate: recurrence.nextOccurrenceDate,
  }
}

export function toRecurrenceCreatePayload(
  values: RecurrenceFormData,
): RecurrenceCreatePayload {
  const parsedAmount = parseCurrencyInput(values.amount)
  if (parsedAmount === null || parsedAmount <= 0) {
    throw new Error('Valor inválido.')
  }
  const postingMode = getValidatedPostingMode(values.postingMode)
  const description = getValidatedDescription(values.description)

  const common = {
    postingMode,
    frequency: values.frequency,
    startDate: values.startDate,
    dayOfWeek: values.dayOfWeek ? Number(values.dayOfWeek) : undefined,
    dayOfMonth: values.dayOfMonth ? Number(values.dayOfMonth) : undefined,
    monthOfYear: values.monthOfYear ? Number(values.monthOfYear) : undefined,
    endType: values.endType,
    endOccurrences: values.endType === 'by_occurrences' && values.endOccurrences
      ? Number(values.endOccurrences)
      : undefined,
    endDate: values.endType === 'until_date' ? values.endDate || undefined : undefined,
    amount: parsedAmount,
    description,
    notes: values.notes || undefined,
  } as const

  if (values.originType === 'transaction') {
    if (!values.accountId || values.accountId.trim() === '') {
      throw new Error('Conta é obrigatória.')
    }

    if (!values.categoryId || values.categoryId.trim() === '') {
      throw new Error('Categoria é obrigatória.')
    }

    return {
      originType: 'transaction',
      accountId: values.accountId,
      categoryId: values.categoryId,
      subcategoryId: values.subcategoryId || undefined,
      ...common,
    }
  }

  if (!values.fromAccountId || values.fromAccountId.trim() === '') {
    throw new Error('Conta de origem é obrigatória.')
  }

  if (!values.toAccountId || values.toAccountId.trim() === '') {
    throw new Error('Conta de destino é obrigatória.')
  }

  return {
    originType: 'transfer',
    fromAccountId: values.fromAccountId,
    toAccountId: values.toAccountId,
    ...common,
  }
}

export function toRecurrenceUpdatePayload(
  values: RecurrenceFormData,
): RecurrenceUpdatePayload {
  const parsedAmount = parseCurrencyInput(values.amount)
  if (parsedAmount === null || parsedAmount <= 0) {
    throw new Error('Valor inválido.')
  }
  const postingMode = getValidatedPostingMode(values.postingMode)
  const description = getValidatedDescription(values.description)

  const common: RecurrenceUpdatePayload = {
    postingMode,
    frequency: values.frequency,
    startDate: values.startDate,
    amount: parsedAmount,
    description,
    notes: values.notes?.trim() ? values.notes.trim() : null,
    endType: values.endType,
  }

  if (values.frequency === 'weekly' || values.frequency === 'biweekly') {
    common.dayOfWeek = Number(values.dayOfWeek)
  }

  if (values.frequency === 'monthly' || values.frequency === 'yearly') {
    common.dayOfMonth = Number(values.dayOfMonth)
  }

  if (values.frequency === 'yearly') {
    common.monthOfYear = Number(values.monthOfYear)
  }

  if (values.endType === 'by_occurrences') {
    common.endOccurrences = Number(values.endOccurrences)
  }

  if (values.endType === 'until_date') {
    common.endDate = values.endDate
  }

  if (values.originType === 'transaction') {
    if (!values.accountId || values.accountId.trim() === '') {
      throw new Error('Conta é obrigatória.')
    }

    if (!values.categoryId || values.categoryId.trim() === '') {
      throw new Error('Categoria é obrigatória.')
    }

    return {
      ...common,
      accountId: values.accountId,
      categoryId: values.categoryId,
      subcategoryId: values.subcategoryId || null,
    }
  }

  if (!values.fromAccountId || values.fromAccountId.trim() === '') {
    throw new Error('Conta de origem é obrigatória.')
  }

  if (!values.toAccountId || values.toAccountId.trim() === '') {
    throw new Error('Conta de destino é obrigatória.')
  }

  return {
    ...common,
    fromAccountId: values.fromAccountId,
    toAccountId: values.toAccountId,
  }
}

export function toScopedRecurrenceUpdatePayload(
  values: RecurrenceFormData,
  detectedChanges?: RecurrenceUpdatePayload,
): RecurrenceUpdatePayload {
  const payload = toRecurrenceUpdatePayload(values)

  if (values.editScope === 'this_and_next') {
    delete payload.startDate
  }

  if (values.editScope === 'single') {
    delete payload.postingMode
    delete payload.frequency
    delete payload.startDate
    delete payload.dayOfWeek
    delete payload.dayOfMonth
    delete payload.monthOfYear
    delete payload.endType
    delete payload.endOccurrences
    delete payload.endDate
  }

  if (detectedChanges) {
    const nullableClearKeys = ['description', 'notes', 'subcategoryId'] as const
    for (const key of nullableClearKeys) {
      if (
        payload[key] === null &&
        !Object.prototype.hasOwnProperty.call(detectedChanges, key)
      ) {
        delete payload[key]
      }
    }
  }

  return payload
}

export function buildScopedRecurrenceUpdatePayload(
  values: RecurrenceFormData,
  recurrence: Recurrence,
): RecurrenceUpdatePayload {
  const parsedAmount = parseCurrencyInput(values.amount)
  if (parsedAmount === null || parsedAmount <= 0) {
    throw new Error('Valor inválido.')
  }

  const normalizeOptionalText = (value: string | undefined) => {
    const trimmed = value?.trim() ?? ''
    return trimmed.length > 0 ? trimmed : null
  }

  const scheduleCandidate = {
    frequency: values.frequency,
    startDate: values.startDate,
    dayOfWeek: values.dayOfWeek ? Number(values.dayOfWeek) : null,
    dayOfMonth: values.dayOfMonth ? Number(values.dayOfMonth) : null,
    monthOfYear: values.monthOfYear ? Number(values.monthOfYear) : null,
    endType: values.endType,
    endOccurrences:
      values.endType === 'by_occurrences' && values.endOccurrences
        ? Number(values.endOccurrences)
        : null,
    endDate:
      values.endType === 'until_date' && values.endDate ? values.endDate : null,
  }

  const businessCandidate: {
    accountId: string | null
    categoryId: string | null
    subcategoryId: string | null
    fromAccountId: string | null
    toAccountId: string | null
    amount: number
    description: string | null
    notes: string | null
  } = {
    accountId: values.originType === 'transaction' ? values.accountId || null : null,
    categoryId:
      values.originType === 'transaction' ? values.categoryId || null : null,
    subcategoryId:
      values.originType === 'transaction' ? values.subcategoryId || null : null,
    fromAccountId:
      values.originType === 'transfer' ? values.fromAccountId || null : null,
    toAccountId: values.originType === 'transfer' ? values.toAccountId || null : null,
    amount: parsedAmount,
    description: getValidatedDescription(values.description),
    notes: normalizeOptionalText(values.notes),
  }

  const diff: RecurrenceUpdatePayload = {}
  const addChange = <K extends keyof RecurrenceUpdatePayload>(
    key: K,
    nextValue: RecurrenceUpdatePayload[K],
    currentValue: unknown,
  ) => {
    if (nextValue !== currentValue) {
      diff[key] = nextValue
    }
  }

  addChange('frequency', scheduleCandidate.frequency, recurrence.frequency)
  addChange('startDate', scheduleCandidate.startDate, recurrence.startDate)
  addChange('dayOfWeek', scheduleCandidate.dayOfWeek ?? undefined, recurrence.dayOfWeek)
  addChange(
    'dayOfMonth',
    scheduleCandidate.dayOfMonth ?? undefined,
    recurrence.dayOfMonth,
  )
  addChange(
    'monthOfYear',
    scheduleCandidate.monthOfYear ?? undefined,
    recurrence.monthOfYear,
  )
  addChange('endType', scheduleCandidate.endType, recurrence.endType)
  addChange(
    'endOccurrences',
    scheduleCandidate.endOccurrences ?? undefined,
    recurrence.endOccurrences,
  )
  addChange('endDate', scheduleCandidate.endDate ?? undefined, recurrence.endDate)
  addChange('amount', businessCandidate.amount, recurrence.amount)
  addChange('description', businessCandidate.description, recurrence.description)
  addChange('notes', businessCandidate.notes, recurrence.notes)
  addChange('postingMode', getValidatedPostingMode(values.postingMode), recurrence.postingMode)

  if (values.originType === 'transaction') {
    addChange('accountId', businessCandidate.accountId ?? undefined, recurrence.accountId)
    addChange(
      'categoryId',
      businessCandidate.categoryId ?? undefined,
      recurrence.categoryId,
    )
    addChange('subcategoryId', businessCandidate.subcategoryId, recurrence.subcategoryId)
  } else {
    addChange(
      'fromAccountId',
      businessCandidate.fromAccountId ?? undefined,
      recurrence.fromAccountId,
    )
    addChange(
      'toAccountId',
      businessCandidate.toAccountId ?? undefined,
      recurrence.toAccountId,
    )
  }

  if (values.editScope === 'single') {
    delete diff.postingMode
    delete diff.frequency
    delete diff.startDate
    delete diff.dayOfWeek
    delete diff.dayOfMonth
    delete diff.monthOfYear
    delete diff.endType
    delete diff.endOccurrences
    delete diff.endDate
  }

  if (values.editScope === 'this_and_next') {
    delete diff.startDate
  }

  return diff
}

export function restrictGlobalRecurrenceUpdatePayloadAfterConsumption(
  payload: RecurrenceUpdatePayload,
): RecurrenceUpdatePayload {
  const restrictedPayload: RecurrenceUpdatePayload = {
    expectedVersion: payload.expectedVersion,
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    restrictedPayload.description = payload.description
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
    restrictedPayload.notes = payload.notes
  }

  return restrictedPayload
}

export function toOccurrenceChangesPayload(values: RecurrenceFormData): {
  amount: number
  description: string
  notes: string | null
} {
  const parsedAmount = parseCurrencyInput(values.amount)
  if (parsedAmount === null || parsedAmount <= 0) {
    throw new Error('Valor inválido.')
  }
  const description = getValidatedDescription(values.description)
  return {
    amount: parsedAmount,
    description,
    notes: values.notes?.trim() || null,
  }
}

export function formatRecurrenceOriginType(originType: Recurrence['originType']) {
  return RECURRENCE_ORIGIN_LABELS[originType]
}

export function formatRecurrenceFrequency(frequency: Recurrence['frequency']) {
  return RECURRENCE_FREQUENCY_LABELS[frequency]
}

export function formatRecurrenceStatus(status: Recurrence['status']) {
  return RECURRENCE_STATUS_LABELS[status]
}

export function formatRecurrenceTimelineStatus(
  status: RecurrenceTimelineItem['status'],
) {
  return RECURRENCE_TIMELINE_STATUS_LABELS[status]
}

export function formatRecurrenceTimelineSource(
  source: RecurrenceTimelineItem['source'],
) {
  return RECURRENCE_TIMELINE_SOURCE_LABELS[source]
}

export function formatRecurrenceCategoryTypeLabel(type: Category['type']) {
  return type === 'income' ? 'receita' : 'despesa'
}

export function formatDerivedTransactionTypeLabel(type: Category['type'] | null) {
  if (type === 'income') return 'Receita'
  if (type === 'expense') return 'Despesa'
  return 'Selecione uma categoria'
}

export function formatRecurrenceTarget(
  recurrence: Recurrence,
  accountsById: Map<string, { name: string }>,
  categoriesById: Map<string, Category>,
) {
  if (recurrence.originType === 'transaction') {
    const accountName = recurrence.accountId
      ? accountsById.get(recurrence.accountId)?.name ?? recurrence.accountId
      : '-'
    const categoryName = recurrence.categoryId
      ? categoriesById.get(recurrence.categoryId)?.name ?? recurrence.categoryId
      : '-'
    return `${accountName} · ${categoryName}`
  }

  const fromName = recurrence.fromAccountId
    ? accountsById.get(recurrence.fromAccountId)?.name ?? recurrence.fromAccountId
    : '-'
  const toName = recurrence.toAccountId
    ? accountsById.get(recurrence.toAccountId)?.name ?? recurrence.toAccountId
    : '-'
  return `${fromName} → ${toName}`
}

export function formatIsoDateToPtBr(isoDate: string | null | undefined) {
  if (!isoDate) return '-'
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}

/**
 * Compara duas datas ISO (YYYY-MM-DD) lexicograficamente.
 * Retorna -1 se `a < b`, 1 se `a > b`, 0 se iguais.
 *
 * Espelha o helper backend (fonte de verdade):
 * `opa-finance-api/src/core/utils/recurrence-schedule.utils.ts`.
 * Usado aqui em verificações de timeline/projeção do feature de recorrências.
 * Equivalência funcional ancorada em testes simétricos (REC-REV-026).
 */
export function compareIsoDate(a: string, b: string) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Adiciona 1 ano à data ISO, ajustando o dia para o último válido do mês destino
 * (ex.: 2024-02-29 -> 2025-02-28).
 *
 * Espelha o helper backend (fonte de verdade):
 * `opa-finance-api/src/modules/recurrences/recurrence.helpers.ts`.
 * Usado aqui apenas como hint visual para `untilDate` da timeline.
 * Testes simétricos em ambos os lados (REC-REV-014).
 */
export function addOneYearIsoDate(isoDate: string) {
  const [yearValue, monthValue, dayValue] = isoDate.split('-').map(Number)
  const maxDay = new Date(Date.UTC(yearValue + 1, monthValue, 0)).getUTCDate()
  const date = new Date(
    Date.UTC(yearValue + 1, monthValue - 1, Math.min(dayValue, maxDay)),
  )
  return date.toISOString().slice(0, 10)
}

export function getRecurrenceOperationalEndDate(recurrence: Recurrence) {
  if (recurrence.endType === 'never') {
    return addOneYearIsoDate(recurrence.startDate)
  }

  if (recurrence.endType === 'until_date') {
    return recurrence.endDate
  }

  return null
}

export function getRecurrenceEditErrorMessage(error: unknown) {
  const message = getApiErrorMessage(error)
  const normalizedMessage = message
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (
    normalizedMessage.includes('ocorrencia materializada passada') ||
    normalizedMessage.includes('ja materializada')
  ) {
    return 'Ocorrência materializada no passado não pode ser editada por este fluxo. Faça o ajuste manual em Transações.'
  }

  return message
}

export function getRecurrenceConfirmErrorMessage(error: unknown) {
  const message = getApiErrorMessage(error)
  const status = getApiErrorStatus(error)
  const normalizedMessage = message
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const looksLikeRangeError =
    normalizedMessage.includes('data ajustada') ||
    normalizedMessage.includes('occurrencedate') ||
    normalizedMessage.includes('intervalo') ||
    normalizedMessage.includes('range')

  if (status === 422 && looksLikeRangeError) {
    if (
      normalizedMessage.includes('data ajustada deve estar entre') ||
      normalizedMessage.includes('data ajustada precisa ficar entre')
    ) {
      return message
    }

    return 'A data ajustada precisa ficar dentro do intervalo permitido para esta confirmação.'
  }

  return message
}

export function getTodayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayIsoDateInTimezone(timezone?: string | null) {
  if (!timezone) {
    return getTodayIsoDate()
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = formatter.formatToParts(new Date())
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value

    if (!year || !month || !day) {
      return getTodayIsoDate()
    }
    return `${year}-${month}-${day}`
  } catch {
    return getTodayIsoDate()
  }
}
