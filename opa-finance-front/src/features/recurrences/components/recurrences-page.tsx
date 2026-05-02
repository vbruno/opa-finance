import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
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
  toRecurrenceCreatePayload,
} from '@/features/recurrences/model/recurrences.helpers'
import type {
  RecurrencesNavigateFn,
  RecurrencesSearchParams,
} from '@/features/recurrences/model/recurrences.types'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getApiErrorMessage } from '@/lib/apiError'
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
  const finalizeMutation = useFinalizeRecurrence()
  const deleteMutation = useDeleteRecurrence()
  const skipMutation = useSkipRecurrenceOccurrence()

  const accountsById = useMemo(
    () => new Map((accountsQuery.data ?? []).map((account) => [account.id, account])),
    [accountsQuery.data],
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
  const frequency = form.watch('frequency')
  const endType = form.watch('endType')
  const selectedCategoryId = form.watch('categoryId')
  const editScope = form.watch('editScope')
  const selectedCategoryType = useMemo(() => {
    if (originType !== 'transaction' || !selectedCategoryId) {
      return null
    }
    return categoriesById.get(selectedCategoryId)?.type ?? null
  }, [categoriesById, originType, selectedCategoryId])
  const isEditing = Boolean(editingRecurrence)
  const isSingleScopeEdit = isEditing && editScope === 'single'
  const isAnyMutationPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    editByScopeMutation.isPending

  const subcategoriesQuery = useQuery({
    queryKey: ['subcategories', 'recurrences-form', selectedCategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return []
      return fetchSubcategories(selectedCategoryId)
    },
    enabled:
      isFormOpen &&
      originType === 'transaction' &&
      Boolean(selectedCategoryId),
  })
  const isFormSupportDataLoading =
    accountsQuery.isLoading ||
    categoriesQuery.isLoading ||
    (isFormOpen &&
      originType === 'transaction' &&
      Boolean(selectedCategoryId) &&
      (subcategoriesQuery.isLoading || subcategoriesQuery.isFetching))
  const isSubcategoriesError =
    isFormOpen &&
    originType === 'transaction' &&
    Boolean(selectedCategoryId) &&
    subcategoriesQuery.isError

  const total = recurrencesQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const recurrencesErrorMessage = recurrencesQuery.isError
    ? getApiErrorMessage(recurrencesQuery.error)
    : undefined

  useEffect(() => {
    const currentCategoryId = form.getValues('categoryId')
    const currentSubcategoryId = form.getValues('subcategoryId')
    if (!currentCategoryId || !currentSubcategoryId) return
    if (subcategoriesQuery.isLoading || subcategoriesQuery.isFetching) return
    if (!subcategoriesQuery.data) return

    const availableSubcategories = subcategoriesQuery.data ?? []
    const hasCurrent = availableSubcategories.some(
      (subcategory) => subcategory.id === currentSubcategoryId,
    )
    if (!hasCurrent) {
      form.setValue('subcategoryId', '')
    }
  }, [
    form,
    subcategoriesQuery.data,
    subcategoriesQuery.isFetching,
    subcategoriesQuery.isLoading,
  ])

  function openCreateModal() {
    setEditingRecurrence(null)
    setFormError(null)
    setConflictRecurrenceId(null)
    form.reset(getDefaultRecurrenceFormValues(userTimezone))
    setIsFormOpen(true)
  }

  function openEditModal(recurrence: Recurrence) {
    setEditingRecurrence(recurrence)
    setFormError(null)
    setConflictRecurrenceId(null)
    form.reset(getRecurrenceFormValuesFromEntity(recurrence))
    setIsFormOpen(true)
  }

  function openDetailsModal(recurrence: Recurrence) {
    setDetailsRecurrence(recurrence)
    setActionError(null)
  }

  function openConfirmOccurrenceModal(occurrence: RecurrenceTimelineItem) {
    setConfirmOccurrence(occurrence)
    setActionError(null)
  }

  async function handleSkipOccurrence(occurrence: RecurrenceTimelineItem) {
    if (!detailsRecurrence || !occurrence.id || occurrence.version === null) return

    setActionError(null)
    const shouldSkip = window.confirm(
      'Ignorar esta pendência? Ela continuará consumindo a posição da recorrência.',
    )
    if (!shouldSkip) return

    const reason = window.prompt('Motivo opcional para ignorar:') ?? undefined

    try {
      await skipMutation.mutateAsync({
        occurrenceId: occurrence.id,
        payload: {
          expectedVersion: occurrence.version,
          reason: reason?.trim() ? reason.trim() : undefined,
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

  async function handleFinalize(recurrence: Recurrence) {
    if (
      !window.confirm(
        'Finalizar esta recorrência? Ela deixará de gerar novas ocorrências.',
      )
    ) {
      return
    }

    setFormError(null)
    try {
      await finalizeMutation.mutateAsync(recurrence.id)
    } catch (error) {
      setFormError(getApiErrorMessage(error))
    }
  }

  async function handleDelete(recurrence: Recurrence) {
    setFormError(null)

    if (recurrence.status === 'active') {
      setFormError('Finalize a recorrência antes de excluir.')
      return
    }

    if (
      !window.confirm(
        'Excluir esta recorrência finalizada? Esta operação é lógica e preserva histórico técnico.',
      )
    ) {
      return
    }

    try {
      await deleteMutation.mutateAsync(recurrence.id)
    } catch (error) {
      setFormError(getApiErrorMessage(error))
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
      const createPayload = toRecurrenceCreatePayload(values)

      if (!editingRecurrence) {
        await createMutation.mutateAsync(createPayload)
        closeModal()
        return
      }

      const updatePayload = {
        ...buildScopedRecurrenceUpdatePayload(values, editingRecurrence),
      }

      if (Object.keys(updatePayload).length === 0) {
        setFormError('Nenhuma alteração detectada para salvar.')
        return
      }

      updatePayload.expectedVersion = editingRecurrence.version

      if (values.editScope === 'all') {
        await updateMutation.mutateAsync({
          id: editingRecurrence.id,
          payload: updatePayload,
        })
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
          <p className="text-sm text-muted-foreground">
            Gerencie regras recorrentes de transações e transferências.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 size-4" />
          Nova recorrência
        </Button>
      </div>

      <RecurrencesFilters
        search={search}
        accounts={accountsQuery.data ?? []}
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
        finalizePending={finalizeMutation.isPending}
        deletePending={deleteMutation.isPending}
        accountsById={accountsById}
        categoriesById={categoriesById}
        onRetry={() => void recurrencesQuery.refetch()}
        onOpenCreateModal={openCreateModal}
        onOpenDetails={openDetailsModal}
        onOpenEditModal={openEditModal}
        onFinalize={(recurrence) => void handleFinalize(recurrence)}
        onDelete={(recurrence) => void handleDelete(recurrence)}
        onPrevPage={() => setSearch({ page: Math.max(1, page - 1) })}
        onNextPage={() => setSearch({ page: Math.min(totalPages, page + 1) })}
      />

      <RecurrenceDetailsModal
        recurrence={detailsRecurrence}
        accountsById={accountsById}
        categoriesById={categoriesById}
        onClose={closeDetailsModal}
        onOpenConfirmOccurrence={openConfirmOccurrenceModal}
        onSkipOccurrence={(occurrence) => void handleSkipOccurrence(occurrence)}
      />

      <ConfirmRecurrenceOccurrenceModal
        recurrence={detailsRecurrence}
        occurrence={confirmOccurrence}
        accounts={(accountsQuery.data ?? []).filter(Boolean)}
        categories={categories}
        onClose={() => setConfirmOccurrence(null)}
      />

      <RecurrenceFormModal
        open={isFormOpen}
        isEditing={isEditing}
        isSingleScopeEdit={isSingleScopeEdit}
        isAnyMutationPending={isAnyMutationPending}
        isFormSupportDataLoading={isFormSupportDataLoading}
        isSubcategoriesError={isSubcategoriesError}
        formError={formError}
        conflictRecurrenceId={conflictRecurrenceId}
        isConflictRefetching={conflictRecurrenceQuery.isFetching}
        editingRecurrence={editingRecurrence}
        accounts={accountsQuery.data ?? []}
        categories={categories}
        subcategories={subcategoriesQuery.data ?? []}
        selectedCategoryType={selectedCategoryType}
        originType={originType}
        frequency={frequency}
        endType={endType}
        editScope={editScope}
        form={form}
        onClose={closeModal}
        onSubmit={onSubmit}
        onReloadAfterConflict={handleReloadAfterConflict}
        onSubcategoriesRefetch={() => void subcategoriesQuery.refetch()}
      />
    </div>
  )
}
