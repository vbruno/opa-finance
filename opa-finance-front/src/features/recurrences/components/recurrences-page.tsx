import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/features/accounts'
import { getUser } from '@/features/auth'
import {
  fetchSubcategories,
  useCategories,
} from '@/features/categories'
import {
  useCreateRecurrence,
  useDeleteRecurrence,
  useRecurrence,
  useEditRecurrenceByScope,
  useFinalizeRecurrence,
  useSkipRecurrenceOccurrence,
  useRecurrences,
  useUpdateRecurrence,
  useUpsertRecurrenceOccurrenceOverride,
  type Recurrence,
  type RecurrenceEditScope,
  type RecurrenceTimelineItem,
} from '@/features/recurrences'
import { useRecurrencesSearchParams } from '@/features/recurrences/hooks/use-recurrences-search-params'
import {
  buildScopedRecurrenceUpdatePayload,
  compareIsoDate,
  getDefaultRecurrenceFormValues,
  getRecurrenceEditErrorMessage,
  getRecurrenceFormValuesFromEntity,
  getTodayIsoDateInTimezone,
  restrictGlobalRecurrenceUpdatePayloadAfterConsumption,
  toOccurrenceChangesPayload,
  toRecurrenceCreatePayload,
  toScopedRecurrenceUpdatePayload,
} from '@/features/recurrences/model/recurrences.helpers'
import type {
  RecurrencesNavigateFn,
  RecurrencesSearchParams,
} from '@/features/recurrences/model/recurrences.types'
import { useDebouncedValue } from '@/features/transactions/hooks/use-debounced-value'
import { buildDescriptionSuggestions } from '@/features/transactions/model/transactions-page.helpers'
import { useTransactionDescriptions } from '@/features/transactions/transactions.api'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { api } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrencyValue } from '@/lib/utils'
import {
  recurrenceFormSchema,
  type RecurrenceFormData,
} from '@/schemas/recurrence.schema'

import { ConfirmRecurrenceOccurrenceModal } from './confirm-recurrence-occurrence-modal'
import { RecurrenceDetailsModal } from './recurrence-details-modal'
import { RecurrenceFormModal } from './recurrence-form-modal'
import { RecurrencesFilters } from './recurrences-filters'
import { RecurrencesList } from './recurrences-list'

type RecurrencesPageProps = {
  search: RecurrencesSearchParams
  navigate: RecurrencesNavigateFn
}

export function RecurrencesPage({ search, navigate }: RecurrencesPageProps) {
  const isDesktop = useMediaQuery('(min-width: 960px)')
  const userTimezone = getUser()?.timezone

  const { page, limit, setSearch } = useRecurrencesSearchParams({ search, navigate })

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isOccurrenceEditMode, setIsOccurrenceEditMode] = useState(false)
  const [occurrenceEditStatus, setOccurrenceEditStatus] = useState<'projected' | 'pending_review' | null>(null)
  const [editingRecurrence, setEditingRecurrence] = useState<Recurrence | null>(
    null,
  )
  const [detailsRecurrence, setDetailsRecurrence] = useState<Recurrence | null>(
    null,
  )
  const [confirmOccurrence, setConfirmOccurrence] = useState<RecurrenceTimelineItem | null>(
    null,
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<
    | { type: 'finalize'; recurrence: Recurrence }
    | { type: 'delete'; recurrence: Recurrence }
    | { type: 'skip-occurrence'; occurrence: RecurrenceTimelineItem }
    | null
  >(null)
  const [locallyConsumedRecurrenceIds, setLocallyConsumedRecurrenceIds] = useState<string[]>([])
  const [skipReason, setSkipReason] = useState('')
  const [conflictRecurrenceId, setConflictRecurrenceId] = useState<string | null>(
    null,
  )

  const queryClient = useQueryClient()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const recurrencesQuery = useRecurrences({
    page,
    limit,
    originType: search.originType,
    status: search.status,
    frequency: search.frequency,
    accountId: search.accountId || undefined,
    q: search.q || undefined,
  })
  const conflictRecurrenceQuery = useRecurrence(conflictRecurrenceId ?? undefined)

  const createMutation = useCreateRecurrence()
  const updateMutation = useUpdateRecurrence()
  const editByScopeMutation = useEditRecurrenceByScope()
  const upsertOverrideMutation = useUpsertRecurrenceOccurrenceOverride()
  const finalizeMutation = useFinalizeRecurrence()
  const deleteMutation = useDeleteRecurrence()
  const skipMutation = useSkipRecurrenceOccurrence()

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const primaryAccountId = useMemo(
    () => accounts.find((a) => a.isPrimary)?.id ?? accounts[0]?.id ?? '',
    [accounts],
  )
  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )
  const categories = useMemo(
    () => (categoriesQuery.data ?? []).filter((category) => !category.system),
    [categoriesQuery.data],
  )
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const form = useForm<RecurrenceFormData>({
    resolver: zodResolver(recurrenceFormSchema),
    defaultValues: getDefaultRecurrenceFormValues(userTimezone),
  })

  const originType = form.watch('originType')
  const editScope = form.watch('editScope')
  const isEditing = Boolean(editingRecurrence)
  const isSingleScopeEdit = isEditing && editScope === 'single'
  const isAnyMutationPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    editByScopeMutation.isPending ||
    upsertOverrideMutation.isPending

  const categoryIdsKey = useMemo(
    () => categories.map((c) => c.id).join(','),
    [categories],
  )
  const allSubcategoriesQuery = useQuery({
    queryKey: ['subcategories', 'recurrences-form-all', categoryIdsKey],
    queryFn: async () => {
      const entries = await Promise.all(
        categories.map(async (category) => {
          const subs = await fetchSubcategories(category.id)
          return [category.id, subs] as const
        }),
      )
      return Object.fromEntries(entries)
    },
    enabled: isFormOpen && originType === 'transaction' && categories.length > 0,
  })
  const subcategoriesByCategory = allSubcategoriesQuery.data ?? {}

  const selectedAccountId = form.watch('accountId')
  const descriptionValue = form.watch('description')
  const debouncedDescription = useDebouncedValue(descriptionValue, 1000)
  const trimmedDescription = debouncedDescription?.trim() ?? ''
  const shouldFilterDescriptions = /\s/.test(debouncedDescription ?? '') || trimmedDescription.length > 0

  const filteredDescriptionsQuery = useTransactionDescriptions(
    { accountId: selectedAccountId ?? '', q: trimmedDescription, limit: 20 },
    { enabled: isFormOpen && Boolean(selectedAccountId) && shouldFilterDescriptions },
  )
  const descriptionSuggestions = useMemo(
    () =>
      buildDescriptionSuggestions({
        baseItems: [],
        filteredItems: filteredDescriptionsQuery.data?.items ?? [],
        shouldFilter: shouldFilterDescriptions,
        queryText: trimmedDescription,
      }),
    [filteredDescriptionsQuery.data, shouldFilterDescriptions, trimmedDescription],
  )

  const isFormSupportDataLoading =
    accountsQuery.isLoading ||
    categoriesQuery.isLoading ||
    (isFormOpen && originType === 'transaction' && allSubcategoriesQuery.isLoading)
  const isSubcategoriesError =
    isFormOpen && originType === 'transaction' && allSubcategoriesQuery.isError

  const total = recurrencesQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const recurrencesErrorMessage = recurrencesQuery.isError
    ? getApiErrorMessage(recurrencesQuery.error)
    : undefined

  function openCreateModal() {
    setEditingRecurrence(null)
    setFormError(null)
    setConflictRecurrenceId(null)
    form.reset({ ...getDefaultRecurrenceFormValues(userTimezone), accountId: primaryAccountId })
    setIsFormOpen(true)
  }

  async function openEditModal(recurrence: Recurrence) {
    setFormError(null)
    setConflictRecurrenceId(null)
    setIsOccurrenceEditMode(false)

    try {
      const response = await api.get<Recurrence>(`/recurrences/${recurrence.id}`)
      const latestRecurrence = {
        ...response.data,
        hasConsumedOccurrences:
          response.data.hasConsumedOccurrences ||
          recurrence.hasConsumedOccurrences ||
          locallyConsumedRecurrenceIds.includes(recurrence.id),
      }

      setEditingRecurrence(latestRecurrence)
      form.reset(getRecurrenceFormValuesFromEntity(latestRecurrence))
      setIsFormOpen(true)
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, {
          defaultMessage: 'Não foi possível carregar os dados mais recentes da recorrência.',
        }),
      )
    }
  }

  async function openOccurrenceEditModal(item: RecurrenceTimelineItem) {
    if (!detailsRecurrence) return
    if (item.status !== 'projected' && item.status !== 'pending_review') return
    setFormError(null)
    setConflictRecurrenceId(null)

    try {
      const response = await api.get<Recurrence>(`/recurrences/${detailsRecurrence.id}`)
      const latestRecurrence = response.data

      setEditingRecurrence(latestRecurrence)
      setIsOccurrenceEditMode(true)
      setOccurrenceEditStatus(item.status)
      form.reset({
        ...getRecurrenceFormValuesFromEntity(latestRecurrence),
        amount: `$ ${formatCurrencyValue(item.amount)}`,
        editScope: 'single',
        occurrenceDate: item.occurrenceDate,
      })
      setIsFormOpen(true)
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, {
          defaultMessage: 'Não foi possível carregar os dados da recorrência para edição.',
        }),
      )
    }
  }

  function openDetailsModal(recurrence: Recurrence) {
    setDetailsRecurrence({
      ...recurrence,
      hasConsumedOccurrences:
        recurrence.hasConsumedOccurrences || locallyConsumedRecurrenceIds.includes(recurrence.id),
    })
    setActionError(null)
  }

  function markRecurrenceAsConsumed(recurrenceId: string) {
    setLocallyConsumedRecurrenceIds((current) =>
      current.includes(recurrenceId) ? current : [...current, recurrenceId],
    )
    setDetailsRecurrence((current) =>
      current?.id === recurrenceId
        ? { ...current, hasConsumedOccurrences: true }
        : current,
    )
    setEditingRecurrence((current) =>
      current?.id === recurrenceId
        ? { ...current, hasConsumedOccurrences: true }
        : current,
    )
  }

  function openConfirmOccurrenceModal(occurrence: RecurrenceTimelineItem) {
    setConfirmOccurrence(occurrence)
    setActionError(null)
  }

  function handleSkipOccurrence(occurrence: RecurrenceTimelineItem) {
    if (!detailsRecurrence || !occurrence.id || occurrence.version === null) return
    setSkipReason('')
    setConfirmDialog({ type: 'skip-occurrence', occurrence })
  }

  async function executeSkipOccurrence(occurrence: RecurrenceTimelineItem) {
    if (!occurrence.id || occurrence.version === null) return
    setConfirmDialog(null)
    setActionError(null)
    try {
      await skipMutation.mutateAsync({
        occurrenceId: occurrence.id,
        payload: {
          expectedVersion: occurrence.version,
          reason: skipReason.trim() || undefined,
        },
      })
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        void queryClient.invalidateQueries({ queryKey: ['recurrence-timeline'] })
      }
      setActionError(getApiErrorMessage(error))
    }
  }

  const closeModal = useCallback(() => {
    if (isAnyMutationPending) return
    setIsFormOpen(false)
    setIsOccurrenceEditMode(false)
    setOccurrenceEditStatus(null)
    setEditingRecurrence(null)
    setFormError(null)
    setConflictRecurrenceId(null)
    form.reset(getDefaultRecurrenceFormValues(userTimezone))
  }, [form, isAnyMutationPending, userTimezone])

  const closeDetailsModal = useCallback(() => {
    setDetailsRecurrence(null)
    setConfirmOccurrence(null)
    setActionError(null)
  }, [])

  useEffect(() => {
    if (!isFormOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isAnyMutationPending) {
        event.preventDefault()
        closeModal()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeModal, isAnyMutationPending, isFormOpen])

  function handleFinalize(recurrence: Recurrence) {
    setConfirmDialog({ type: 'finalize', recurrence })
  }

  async function executeFinalize(recurrence: Recurrence) {
    setConfirmDialog(null)
    setActionError(null)
    try {
      const finalizedRecurrence = await finalizeMutation.mutateAsync(recurrence.id)
      setDetailsRecurrence((current) =>
        current?.id === finalizedRecurrence.id ? finalizedRecurrence : current,
      )
    } catch (error) {
      setActionError(getApiErrorMessage(error))
    }
  }

  function handleDelete(recurrence: Recurrence) {
    if (recurrence.status === 'active') {
      setActionError('Finalize a recorrência antes de excluir.')
      return
    }
    setConfirmDialog({ type: 'delete', recurrence })
  }

  async function executeDelete(recurrence: Recurrence) {
    setConfirmDialog(null)
    setActionError(null)
    try {
      await deleteMutation.mutateAsync(recurrence.id)
      setDetailsRecurrence((current) =>
        current?.id === recurrence.id ? null : current,
      )
      setConfirmOccurrence(null)
    } catch (error) {
      setActionError(getApiErrorMessage(error))
    }
  }

  async function handleReloadAfterConflict() {
    if (!conflictRecurrenceId) return

    setFormError(null)

    try {
      const [singleResult] = await Promise.all([
        conflictRecurrenceQuery.refetch(),
        recurrencesQuery.refetch(),
      ])

      const refreshedRecurrence = singleResult.data

      if (!refreshedRecurrence) {
        setConflictRecurrenceId(null)
        setEditingRecurrence(null)
        setIsFormOpen(false)
        form.reset(getDefaultRecurrenceFormValues(userTimezone))
        setFormError(
          'A recorrência não foi encontrada após recarregar. Atualize os filtros da listagem.',
        )
        return
      }

      setEditingRecurrence(refreshedRecurrence)
      form.reset(getRecurrenceFormValuesFromEntity(refreshedRecurrence))
      setConflictRecurrenceId(null)
      setFormError('Dados recarregados. Revise as alterações e salve novamente.')
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, {
          defaultMessage: 'Não foi possível recarregar os dados da recorrência.',
        }),
      )
    }
  }

  async function onSubmit(values: RecurrenceFormData) {
    setFormError(null)
    setConflictRecurrenceId(null)

    if (
      !isOccurrenceEditMode &&
      editingRecurrence &&
      values.editScope === 'single' &&
      values.occurrenceDate &&
      compareIsoDate(
        values.occurrenceDate,
        getTodayIsoDateInTimezone(editingRecurrence.timezone),
      ) < 0
    ) {
      setFormError(
        'Ocorrência materializada no passado não pode ser editada por este fluxo. Faça o ajuste manual em Transações.',
      )
      return
    }

    try {
      if (!editingRecurrence) {
        const createPayload = toRecurrenceCreatePayload(values)
        await createMutation.mutateAsync(createPayload)
        closeModal()
        return
      }

      if (isOccurrenceEditMode) {
        if (!values.occurrenceDate) {
          setFormError('Data da ocorrência ausente.')
          return
        }

        const scope = values.editScope
        if (scope !== 'single' && scope !== 'this_and_next') {
          setFormError('Escopo inválido para edição de ocorrência.')
          return
        }

        const changes = toOccurrenceChangesPayload(values)

        if (occurrenceEditStatus === 'projected' && scope === 'single') {
          await upsertOverrideMutation.mutateAsync({
            recurrenceId: editingRecurrence.id,
            payload: {
              occurrenceDate: values.occurrenceDate,
              ...changes,
            },
          })
          closeModal()
          return
        }

        await editByScopeMutation.mutateAsync({
          id: editingRecurrence.id,
          payload: { scope, occurrenceDate: values.occurrenceDate, changes },
        })
        closeModal()
        return
      }

      const detectedChanges = buildScopedRecurrenceUpdatePayload(
        values,
        editingRecurrence,
      )

      if (Object.keys(detectedChanges).length === 0) {
        setFormError('Nenhuma alteração detectada para salvar.')
        return
      }

      const updatePayload = toScopedRecurrenceUpdatePayload(
        values,
        detectedChanges,
      )
      updatePayload.expectedVersion = editingRecurrence.version

      if (editingRecurrence.hasConsumedOccurrences && values.editScope === 'all') {
        const restrictedPayload =
          restrictGlobalRecurrenceUpdatePayloadAfterConsumption(updatePayload)

        if (
          Object.keys(restrictedPayload).every(
            (key) => key === 'expectedVersion' || restrictedPayload[key as keyof typeof restrictedPayload] === undefined,
          )
        ) {
          setFormError('Nenhuma alteração detectada para salvar.')
          return
        }

        Object.assign(updatePayload, restrictedPayload)
        for (const key of Object.keys(updatePayload)) {
          if (!(key in restrictedPayload)) {
            delete updatePayload[key as keyof typeof updatePayload]
          }
        }
      }

      if (values.editScope === 'all') {
        const updatedRecurrence = await updateMutation.mutateAsync({
          id: editingRecurrence.id,
          payload: updatePayload,
        })
        setDetailsRecurrence((current) =>
          current?.id === updatedRecurrence.id ? updatedRecurrence : current,
        )
      } else {
        await editByScopeMutation.mutateAsync({
          id: editingRecurrence.id,
          payload: {
            scope: values.editScope as RecurrenceEditScope,
            occurrenceDate: values.occurrenceDate,
            changes: updatePayload,
          },
        })
      }

      closeModal()
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status
      if (status === 409) {
        setConflictRecurrenceId(editingRecurrence?.id ?? null)
        setFormError(
          'Conflito de edição: a recorrência foi alterada por outra sessão. Recarregue a lista e tente novamente.',
        )
        return
      }
      setFormError(getRecurrenceEditErrorMessage(error))
    }
  }

  if (!isDesktop) {
    return (
      <div className="rounded-md border p-4">
        <h1 className="text-lg font-semibold">Recorrências</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A gestão de recorrências está disponível na versão desktop.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarRange className="size-5" />
            Recorrências
          </h1>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 size-4" />
          Nova recorrência
        </Button>
      </div>

      <RecurrencesFilters
        search={search}
        accounts={accounts}
        onSetSearch={setSearch}
      />

      {accountsQuery.isError || categoriesQuery.isError ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          Erro ao carregar dados base da tela.
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void accountsQuery.refetch()}
            >
              Recarregar contas
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void categoriesQuery.refetch()}
            >
              Recarregar categorias
            </Button>
          </div>
        </div>
      ) : null}

      {formError ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {formError}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {actionError}
        </div>
      ) : null}

      <RecurrencesList
        recurrences={recurrencesQuery.data?.data ?? []}
        page={page}
        total={total}
        totalPages={totalPages}
        isLoading={recurrencesQuery.isLoading}
        isError={recurrencesQuery.isError}
        errorMessage={recurrencesErrorMessage}
        accountsById={accountsById}
        categoriesById={categoriesById}
        onRetry={() => void recurrencesQuery.refetch()}
        onOpenCreateModal={openCreateModal}
        onOpenDetails={openDetailsModal}
        onPageChange={(p) => setSearch({ page: p })}
      />

      <RecurrenceDetailsModal
        recurrence={detailsRecurrence}
        accountsById={accountsById}
        categoriesById={categoriesById}
        onClose={closeDetailsModal}
        onEdit={openEditModal}
        onFinalize={(recurrence) => void handleFinalize(recurrence)}
        onDelete={(recurrence) => void handleDelete(recurrence)}
        finalizePending={finalizeMutation.isPending}
        deletePending={deleteMutation.isPending}
        errorMessage={actionError}
        onOpenConfirmOccurrence={openConfirmOccurrenceModal}
        onSkipOccurrence={(occurrence) => void handleSkipOccurrence(occurrence)}
        onActionError={setActionError}
        onEditOccurrence={(item) => void openOccurrenceEditModal(item)}
      />

      <ConfirmRecurrenceOccurrenceModal
        recurrence={detailsRecurrence}
        occurrence={confirmOccurrence}
        accounts={(accounts).filter(Boolean)}
        categories={categories}
        onConfirmed={markRecurrenceAsConsumed}
        onClose={() => setConfirmOccurrence(null)}
      />

      <RecurrenceFormModal
        open={isFormOpen}
        isEditing={isEditing}
        isOccurrenceEdit={isOccurrenceEditMode}
        occurrenceEditStatus={occurrenceEditStatus ?? undefined}
        isSingleScopeEdit={isSingleScopeEdit}
        isAnyMutationPending={isAnyMutationPending}
        isFormSupportDataLoading={isFormSupportDataLoading}
        isSubcategoriesError={isSubcategoriesError}
        formError={formError}
        conflictRecurrenceId={conflictRecurrenceId}
        isConflictRefetching={conflictRecurrenceQuery.isFetching}
        editingRecurrence={editingRecurrence}
        isGlobalStructureLocked={
          Boolean(editingRecurrence?.hasConsumedOccurrences) && !isOccurrenceEditMode
        }
        accounts={accounts}
        categories={categories}
        subcategoriesByCategory={subcategoriesByCategory}
        descriptionSuggestions={descriptionSuggestions}
        areDescriptionSuggestionsLoading={filteredDescriptionsQuery.isLoading}
        hasDescriptionSuggestionsError={filteredDescriptionsQuery.isError}
        shouldFilterSuggestions={shouldFilterDescriptions}
        originType={originType}
        editScope={editScope}
        form={form}
        onClose={closeModal}
        onSubmit={onSubmit}
        onReloadAfterConflict={handleReloadAfterConflict}
        onSubcategoriesRefetch={() => void allSubcategoriesQuery.refetch()}
      />

      {/* Finalizar */}
      <AlertDialog
        open={confirmDialog?.type === 'finalize'}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar recorrência</AlertDialogTitle>
            <AlertDialogDescription>
              Ela deixará de gerar novas ocorrências. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog?.type === 'finalize' && void executeFinalize(confirmDialog.recurrence)}
            >
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir */}
      <AlertDialog
        open={confirmDialog?.type === 'delete'}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência</AlertDialogTitle>
            <AlertDialogDescription>
              Esta operação é lógica e preserva o histórico técnico, mas a recorrência não poderá ser recuperada pela interface.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => confirmDialog?.type === 'delete' && void executeDelete(confirmDialog.recurrence)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ignorar ocorrência */}
      <AlertDialog
        open={confirmDialog?.type === 'skip-occurrence'}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignorar pendência</AlertDialogTitle>
            <AlertDialogDescription>
              A ocorrência continuará consumindo a posição da recorrência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="skip-reason-page">Motivo (opcional)</Label>
            <Input
              id="skip-reason-page"
              placeholder="Ex.: pagamento adiado"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog?.type === 'skip-occurrence' && void executeSkipOccurrence(confirmDialog.occurrence)}
            >
              Ignorar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
