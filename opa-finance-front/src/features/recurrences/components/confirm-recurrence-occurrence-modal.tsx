import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Account } from '@/features/accounts'
import type { Category } from '@/features/categories'
import { fetchSubcategories } from '@/features/categories'
import {
  useAnticipateRecurrenceOccurrence,
  useConfirmRecurrenceOccurrence,
  type Recurrence,
  type RecurrenceOccurrenceReviewPayload,
  type RecurrenceTimelineItem,
} from '@/features/recurrences'
import { getRecurrenceConfirmErrorMessage } from '@/features/recurrences/model/recurrences.helpers'
import { TransactionAmountField } from '@/features/transactions/components/transaction-amount-field'
import { TransactionDateField } from '@/features/transactions/components/transaction-date-field'
import { TransactionNotesField } from '@/features/transactions/components/transaction-notes-field'
import { formatCurrencyValue, parseCurrencyInput } from '@/lib/utils'

type ConfirmFormData = {
  originType: 'transaction' | 'transfer'
  occurrenceDate: string
  amount: string
  description?: string
  notes?: string
  accountId?: string
  categoryId?: string
  subcategoryId?: string
  fromAccountId?: string
  toAccountId?: string
}

type ConfirmRecurrenceOccurrenceModalProps = {
  recurrence: Recurrence | null
  occurrence: RecurrenceTimelineItem | null
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onConfirmed?: (recurrenceId: string) => void
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildDefaults(
  recurrence: Recurrence | null,
  reviewPayload: RecurrenceOccurrenceReviewPayload | null,
  occurrence: RecurrenceTimelineItem | null,
): ConfirmFormData {
  if (!reviewPayload && recurrence) {
    return {
      originType: recurrence.originType,
      occurrenceDate: occurrence?.occurrenceDate ?? '',
      amount: `$ ${formatCurrencyValue(occurrence?.amount ?? recurrence.amount)}`,
      description: recurrence.description ?? '',
      notes: recurrence.notes ?? '',
      accountId: recurrence.accountId ?? '',
      categoryId: recurrence.categoryId ?? '',
      subcategoryId: recurrence.subcategoryId ?? '',
      fromAccountId: recurrence.fromAccountId ?? '',
      toAccountId: recurrence.toAccountId ?? '',
    }
  }
  return {
    originType: recurrence?.originType ?? reviewPayload?.originType ?? 'transaction',
    occurrenceDate: reviewPayload?.occurrenceDate ?? '',
    amount: reviewPayload ? `$ ${formatCurrencyValue(reviewPayload.amount)}` : '',
    description: reviewPayload?.description ?? '',
    notes: reviewPayload?.notes ?? '',
    accountId: reviewPayload?.accountId ?? '',
    categoryId: reviewPayload?.categoryId ?? '',
    subcategoryId: reviewPayload?.subcategoryId ?? '',
    fromAccountId: reviewPayload?.fromAccountId ?? '',
    toAccountId: reviewPayload?.toAccountId ?? '',
  }
}

export function ConfirmRecurrenceOccurrenceModal({
  recurrence,
  occurrence,
  accounts,
  categories,
  onClose,
  onConfirmed,
}: ConfirmRecurrenceOccurrenceModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [subcategories, setSubcategories] = useState<Array<{ id: string; name: string }>>([])
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false)

  const isProjected = occurrence?.source === 'projected'

  const queryClient = useQueryClient()
  const confirmMutation = useConfirmRecurrenceOccurrence()
  const anticipateMutation = useAnticipateRecurrenceOccurrence()
  const isSubmitting = confirmMutation.isPending || anticipateMutation.isPending

  const form = useForm<ConfirmFormData>({
    defaultValues: buildDefaults(recurrence, occurrence?.reviewPayload ?? null, occurrence),
  })

  const selectedCategoryId = form.watch('categoryId')
  const selectedSubcategoryId = form.watch('subcategoryId')
  const selectedAccountId = form.watch('accountId')
  const selectedFromAccountId = form.watch('fromAccountId')
  const selectedToAccountId = form.watch('toAccountId')
  const originType =
    recurrence?.originType ?? occurrence?.reviewPayload?.originType ?? 'transaction'

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const readonlyAccountName = selectedAccountId
    ? (accountsById.get(selectedAccountId)?.name ?? selectedAccountId)
    : 'Sem conta'
  const readonlyFromAccountName = selectedFromAccountId
    ? (accountsById.get(selectedFromAccountId)?.name ?? selectedFromAccountId)
    : 'Sem conta'
  const readonlyToAccountName = selectedToAccountId
    ? (accountsById.get(selectedToAccountId)?.name ?? selectedToAccountId)
    : 'Sem conta'
  const readonlyCategoryName = selectedCategoryId
    ? (categoriesById.get(selectedCategoryId)?.name ?? selectedCategoryId)
    : 'Sem categoria'
  const readonlySubcategoryName = selectedSubcategoryId
    ? (subcategories.find((subcategory) => subcategory.id === selectedSubcategoryId)?.name ??
      (subcategoriesLoading ? 'Carregando...' : selectedSubcategoryId))
    : 'Sem subcategoria'

  useEffect(() => {
    if (!occurrence) return
    form.reset(buildDefaults(recurrence, occurrence.reviewPayload, occurrence))
    setSubmitError(null)
  }, [form, occurrence, recurrence])

  useEffect(() => {
    if (!occurrence) return
    const id = window.setTimeout(() => {
      modalRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [occurrence])

  useEffect(() => {
    if (!occurrence) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!isSubmitting) {
          onClose()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSubmitting, onClose, occurrence])

  useEffect(() => {
    if (originType !== 'transaction') {
      setSubcategories([])
      setSubcategoriesLoading(false)
      form.setValue('subcategoryId', '')
      return
    }

    if (!selectedCategoryId) {
      setSubcategories([])
      setSubcategoriesLoading(false)
      form.setValue('subcategoryId', '')
      return
    }

    let cancelled = false
    setSubcategoriesLoading(true)

    void fetchSubcategories(selectedCategoryId)
      .then((items) => {
        if (cancelled) return
        const sorted = [...items].sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
        )
        setSubcategories(sorted)
        const currentSubcategoryId = form.getValues('subcategoryId')
        if (currentSubcategoryId && !sorted.some((item) => item.id === currentSubcategoryId)) {
          form.setValue('subcategoryId', '')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubcategories([])
          form.setValue('subcategoryId', '')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSubcategoriesLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [form, originType, selectedCategoryId, occurrence])

  const canRender = Boolean(
    recurrence &&
      occurrence &&
      (isProjected || (occurrence.id && occurrence.reviewPayload && occurrence.version !== null)),
  )

  async function handleSubmit(values: ConfirmFormData) {
    if (!occurrence || !recurrence) return

    if (!isProjected && (!occurrence.reviewPayload || occurrence.version === null || !occurrence.id)) {
      return
    }

    setSubmitError(null)
    const reviewPayload = occurrence.reviewPayload
    const parsedAmount = parseCurrencyInput(values.amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setSubmitError('Informe um valor válido.')
      return
    }

    const accountId = values.accountId || reviewPayload?.accountId || undefined
    const categoryId = values.categoryId || reviewPayload?.categoryId || undefined
    const subcategoryId = values.subcategoryId || reviewPayload?.subcategoryId || undefined
    const fromAccountId = values.fromAccountId || reviewPayload?.fromAccountId || undefined
    const toAccountId = values.toAccountId || reviewPayload?.toAccountId || undefined

    if (values.originType === 'transaction') {
      if (!accountId) {
        setSubmitError('Selecione a conta.')
        return
      }
      if (!categoryId) {
        setSubmitError('Selecione a categoria.')
        return
      }
    } else {
      if (!fromAccountId) {
        setSubmitError('Selecione a conta de origem.')
        return
      }
      if (!toAccountId) {
        setSubmitError('Selecione a conta de destino.')
        return
      }
      if (fromAccountId === toAccountId) {
        setSubmitError('Origem e destino devem ser diferentes.')
        return
      }
    }

    try {
      if (isProjected) {
        const anticipatePayload =
          values.originType === 'transaction'
            ? {
                occurrenceDate: values.occurrenceDate || occurrence.occurrenceDate,
                amount: parsedAmount,
                description: normalizeOptionalText(values.description) ?? null,
                notes: normalizeOptionalText(values.notes) ?? null,
                accountId,
                categoryId,
                subcategoryId,
              }
            : {
                occurrenceDate: values.occurrenceDate || occurrence.occurrenceDate,
                amount: parsedAmount,
                description: normalizeOptionalText(values.description) ?? null,
                notes: normalizeOptionalText(values.notes) ?? null,
                fromAccountId,
                toAccountId,
              }

        await anticipateMutation.mutateAsync({
          recurrenceId: recurrence.id,
          payload: anticipatePayload,
        })
        onConfirmed?.(recurrence.id)
      } else {
        const confirmPayload =
          values.originType === 'transaction'
            ? {
                expectedVersion: occurrence.version!,
                occurrenceDate: values.occurrenceDate || reviewPayload!.occurrenceDate,
                amount: parsedAmount,
                description:
                  normalizeOptionalText(values.description) ?? reviewPayload!.description ?? null,
                notes: normalizeOptionalText(values.notes) ?? reviewPayload!.notes ?? null,
                accountId,
                categoryId,
                subcategoryId,
              }
            : {
                expectedVersion: occurrence.version!,
                occurrenceDate: values.occurrenceDate || reviewPayload!.occurrenceDate,
                amount: parsedAmount,
                description:
                  normalizeOptionalText(values.description) ?? reviewPayload!.description ?? null,
                notes: normalizeOptionalText(values.notes) ?? reviewPayload!.notes ?? null,
                fromAccountId,
                toAccountId,
              }

        await confirmMutation.mutateAsync({
          occurrenceId: occurrence.id!,
          payload: confirmPayload,
        })
        onConfirmed?.(recurrence.id)
      }
      onClose()
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        void queryClient.invalidateQueries({ queryKey: ['recurrence-timeline'] })
      }
      setSubmitError(getRecurrenceConfirmErrorMessage(error))
    }
  }

  if (!canRender) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4">
      <div className="fixed inset-0" onClick={() => !isSubmitting && onClose()} aria-hidden="true" />
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-recurrence-occurrence-title"
        aria-describedby="confirm-recurrence-occurrence-description"
        className="relative flex w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0 space-y-0.5">
            <h2
              id="confirm-recurrence-occurrence-title"
              className="text-base font-semibold sm:text-lg"
            >
              Confirmar lançamento
            </h2>
            <p
              id="confirm-recurrence-occurrence-description"
              className="text-xs text-muted-foreground sm:text-sm"
            >
              Ajuste os dados da pendência antes de confirmar o lançamento.
            </p>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Fechar
          </Button>
        </div>

        <form className="flex flex-1 min-h-0 flex-col" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5">
            <div className="space-y-3.5">
              {submitError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {submitError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="min-w-0">
                  <TransactionDateField
                    id="confirm-occurrence-date"
                    label="Data do lançamento"
                    register={form.register}
                    errors={form.formState.errors}
                    isMobile={false}
                    fieldName="occurrenceDate"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="min-w-0">
                  <TransactionAmountField
                    id="confirm-amount"
                    control={form.control}
                    errors={form.formState.errors}
                    clearAmountError={() => setSubmitError(null)}
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="confirm-description">Descrição</Label>
                  <Input
                    id="confirm-description"
                    placeholder="Opcional"
                    className="h-10 w-full"
                    disabled={isSubmitting}
                    {...form.register('description')}
                  />
                  {form.formState.errors.description ? (
                    <p className="text-sm text-destructive">
                      {String(form.formState.errors.description.message)}
                    </p>
                  ) : null}
                </div>

                {originType === 'transaction' ? (
                  <>
                    <div className="min-w-0 lg:col-span-2">
                      <Label htmlFor="confirm-account">Conta</Label>
                      <Input
                        id="confirm-account"
                        value={readonlyAccountName}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="h-10 pointer-events-none cursor-default bg-background text-foreground"
                      />
                    </div>

                    <div className="min-w-0">
                      <Label htmlFor="confirm-category">Categoria</Label>
                      <Input
                        id="confirm-category"
                        value={readonlyCategoryName}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="h-10 pointer-events-none cursor-default bg-background text-foreground"
                      />
                      {form.formState.errors.categoryId ? (
                        <p className="text-sm text-destructive">
                          {String(form.formState.errors.categoryId.message)}
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <Label htmlFor="confirm-subcategory">Subcategoria</Label>
                      <Input
                        id="confirm-subcategory"
                        value={readonlySubcategoryName}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="h-10 pointer-events-none cursor-default bg-background text-foreground"
                      />
                      {form.formState.errors.subcategoryId ? (
                        <p className="text-sm text-destructive">
                          {String(form.formState.errors.subcategoryId.message)}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-0">
                      <Label htmlFor="confirm-from-account">Conta de origem</Label>
                      <Input
                        id="confirm-from-account"
                        value={readonlyFromAccountName}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="h-10 pointer-events-none cursor-default bg-background text-foreground"
                      />
                    </div>

                    <div className="min-w-0">
                      <Label htmlFor="confirm-to-account">Conta de destino</Label>
                      <Input
                        id="confirm-to-account"
                        value={readonlyToAccountName}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="h-10 pointer-events-none cursor-default bg-background text-foreground"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="min-w-0">
                <TransactionNotesField
                  id="confirm-notes"
                  label="Notas"
                  fieldName="notes"
                  register={form.register}
                  errors={form.formState.errors}
                  tabIndex={0}
                />
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t px-4 py-3 sm:px-5">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                Confirmar lançamento
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
