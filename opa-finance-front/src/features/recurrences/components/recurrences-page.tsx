import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  useRecurrences,
  useUpdateRecurrence,
  type Recurrence,
  type RecurrenceEditScope,
} from '@/features/recurrences'
import { useRecurrencesSearchParams } from '@/features/recurrences/hooks/use-recurrences-search-params'
import {
  RECURRENCE_DAY_OF_WEEK_OPTIONS,
  RECURRENCE_MONTH_OPTIONS,
} from '@/features/recurrences/model/recurrences.constants'
import {
  buildScopedRecurrenceUpdatePayload,
  compareIsoDate,
  formatDerivedTransactionTypeLabel,
  formatRecurrenceCategoryTypeLabel,
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
  const [formError, setFormError] = useState<string | null>(null)
  const [conflictRecurrenceId, setConflictRecurrenceId] = useState<string | null>(
    null,
  )

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

  const closeModal = useCallback(() => {
    if (isAnyMutationPending) return
    setIsFormOpen(false)
    setEditingRecurrence(null)
    setFormError(null)
    setConflictRecurrenceId(null)
    form.reset(getDefaultRecurrenceFormValues(userTimezone))
  }, [form, isAnyMutationPending, userTimezone])

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
        onOpenEditModal={openEditModal}
        onFinalize={(recurrence) => void handleFinalize(recurrence)}
        onDelete={(recurrence) => void handleDelete(recurrence)}
        onPrevPage={() => setSearch({ page: Math.max(1, page - 1) })}
        onNextPage={() => setSearch({ page: Math.min(totalPages, page + 1) })}
      />

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-3xl rounded-xl border bg-background p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold">
                {isEditing ? 'Editar recorrência' : 'Nova recorrência'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEditing
                  ? 'Atualize os dados da regra e escolha o escopo da edição.'
                  : 'Configure a regra para geração automática de lançamentos.'}
              </p>
            </div>

            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label>Origem</Label>
                  <Select
                    value={originType}
                    onValueChange={(value) => {
                      form.setValue('originType', value as 'transaction' | 'transfer')
                      form.setValue('accountId', '')
                      form.setValue('categoryId', '')
                      form.setValue('subcategoryId', '')
                      form.setValue('fromAccountId', '')
                      form.setValue('toAccountId', '')
                    }}
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transaction">Transação</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Frequência</Label>
                  <Select
                    value={frequency}
                    onValueChange={(value) =>
                      form.setValue('frequency', value as RecurrenceFormData['frequency'])
                    }
                    disabled={isSingleScopeEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Frequência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Quinzenal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Valor</Label>
                  <Input {...form.register('amount')} placeholder="0,00" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <Label>Data inicial</Label>
                  <Input
                    type="date"
                    {...form.register('startDate')}
                    disabled={isSingleScopeEdit}
                  />
                </div>

                {(frequency === 'weekly' || frequency === 'biweekly') && (
                  <div>
                    <Label>Dia da semana</Label>
                    <Select
                      value={form.watch('dayOfWeek') || '__none__'}
                      onValueChange={(value) =>
                        form.setValue('dayOfWeek', value === '__none__' ? '' : value)
                      }
                      disabled={isSingleScopeEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {RECURRENCE_DAY_OF_WEEK_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(frequency === 'monthly' || frequency === 'yearly') && (
                  <div>
                    <Label>Dia do mês</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      {...form.register('dayOfMonth')}
                      disabled={isSingleScopeEdit}
                    />
                  </div>
                )}

                {frequency === 'yearly' && (
                  <div>
                    <Label>Mês</Label>
                    <Select
                      value={form.watch('monthOfYear') || '__none__'}
                      onValueChange={(value) =>
                        form.setValue('monthOfYear', value === '__none__' ? '' : value)
                      }
                      disabled={isSingleScopeEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {RECURRENCE_MONTH_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label>Término</Label>
                  <Select
                    value={endType}
                    onValueChange={(value) =>
                      form.setValue('endType', value as RecurrenceFormData['endType'])
                    }
                    disabled={isSingleScopeEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Término" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Sem fim</SelectItem>
                      <SelectItem value="by_occurrences">Por ocorrências</SelectItem>
                      <SelectItem value="until_date">Por data final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {endType === 'by_occurrences' && (
                  <div>
                    <Label>Qtd. ocorrências</Label>
                    <Input
                      type="number"
                      min={1}
                      {...form.register('endOccurrences')}
                      disabled={isSingleScopeEdit}
                    />
                  </div>
                )}

                {endType === 'until_date' && (
                  <div>
                    <Label>Data final</Label>
                    <Input
                      type="date"
                      {...form.register('endDate')}
                      disabled={isSingleScopeEdit}
                    />
                  </div>
                )}
              </div>

              {originType === 'transaction' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div>
                    <Label>Conta</Label>
                    <Select
                      value={form.watch('accountId') || '__none__'}
                      onValueChange={(value) =>
                        form.setValue('accountId', value === '__none__' ? '' : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {(accountsQuery.data ?? []).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Categoria</Label>
                    <Select
                      value={form.watch('categoryId') || '__none__'}
                      onValueChange={(value) => {
                        const nextValue = value === '__none__' ? '' : value
                        form.setValue('categoryId', nextValue)
                        form.setValue('subcategoryId', '')
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {`${category.name} (${formatRecurrenceCategoryTypeLabel(category.type)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Subcategoria</Label>
                    <Select
                      value={form.watch('subcategoryId') || '__none__'}
                      onValueChange={(value) =>
                        form.setValue('subcategoryId', value === '__none__' ? '' : value)
                      }
                      disabled={!selectedCategoryId || Boolean(isSubcategoriesError)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {(subcategoriesQuery.data ?? []).map((subcategory) => (
                          <SelectItem key={subcategory.id} value={subcategory.id}>
                            {subcategory.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isSubcategoriesError ? (
                      <div className="mt-2 space-y-1 text-xs text-red-300">
                        <p>Erro ao carregar subcategorias da categoria selecionada.</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void subcategoriesQuery.refetch()}
                        >
                          Tentar novamente
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <Label>Tipo (derivado da categoria)</Label>
                    <Input
                      value={formatDerivedTransactionTypeLabel(selectedCategoryType)}
                      readOnly
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label>Conta origem</Label>
                    <Select
                      value={form.watch('fromAccountId') || '__none__'}
                      onValueChange={(value) =>
                        form.setValue('fromAccountId', value === '__none__' ? '' : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {(accountsQuery.data ?? []).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Conta destino</Label>
                    <Select
                      value={form.watch('toAccountId') || '__none__'}
                      onValueChange={(value) =>
                        form.setValue('toAccountId', value === '__none__' ? '' : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione</SelectItem>
                        {(accountsQuery.data ?? []).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label>Descrição</Label>
                  <Input {...form.register('description')} placeholder="Opcional" />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Input {...form.register('notes')} placeholder="Opcional" />
                </div>
              </div>

              {isEditing && editingRecurrence?.status === 'active' ? (
                <div className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2">
                  <div>
                    <Label>Aplicar edição em</Label>
                    <Select
                      value={editScope}
                      onValueChange={(value) =>
                        form.setValue(
                          'editScope',
                          value as RecurrenceFormData['editScope'],
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escopo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="this_and_next">Esta e próximas</SelectItem>
                        <SelectItem value="single">Somente esta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editScope !== 'all' ? (
                    <div>
                      <Label>Data da ocorrência</Label>
                      <Input
                        type="date"
                        min={
                          editScope === 'single'
                            ? getTodayIsoDateInTimezone(editingRecurrence?.timezone)
                            : undefined
                        }
                        {...form.register('occurrenceDate')}
                      />
                      {editScope === 'single' ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Para ocorrência passada já materializada, faça ajuste manual
                          em Transações.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {formError ? (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">
                  <p>{formError}</p>
                  {conflictRecurrenceId ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleReloadAfterConflict()}
                        disabled={conflictRecurrenceQuery.isFetching}
                      >
                        Recarregar dados da recorrência
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {Object.keys(form.formState.errors).length > 0 ? (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">
                  Verifique os campos obrigatórios e tente novamente.
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isAnyMutationPending ||
                    isFormSupportDataLoading ||
                    Boolean(isSubcategoriesError)
                  }
                >
                  {isEditing ? 'Salvar edição' : 'Criar recorrência'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
