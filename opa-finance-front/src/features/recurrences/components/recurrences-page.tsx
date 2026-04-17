import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react'
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
import {
  fetchSubcategories,
  useCategories,
  type Category,
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
  formatIsoDateToPtBr,
  formatRecurrenceCategoryTypeLabel,
  formatRecurrenceFrequency,
  formatRecurrenceOriginType,
  formatRecurrenceStatus,
  formatRecurrenceTarget,
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

type RecurrencesPageProps = {
  search: RecurrencesSearchParams
  navigate: RecurrencesNavigateFn
}

export function RecurrencesPage({ search, navigate }: RecurrencesPageProps) {
  const isDesktop = useMediaQuery('(min-width: 960px)')

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
    defaultValues: getDefaultRecurrenceFormValues(),
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
    form.reset(getDefaultRecurrenceFormValues())
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
    form.reset(getDefaultRecurrenceFormValues())
  }, [form, isAnyMutationPending])

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
        form.reset(getDefaultRecurrenceFormValues())
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

      <div className="rounded-lg border p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          <Input
            placeholder="Buscar por descrição/nota"
            value={search.q ?? ''}
            onChange={(event) =>
              setSearch({ page: 1, q: event.target.value || undefined })
            }
            className="md:col-span-2"
          />

          <Select
            value={search.originType ?? '__all__'}
            onValueChange={(value) =>
              setSearch({
                page: 1,
                originType:
                  value === '__all__' ? undefined : (value as 'transaction' | 'transfer'),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as origens</SelectItem>
              <SelectItem value="transaction">Transação</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={search.status ?? '__all__'}
            onValueChange={(value) =>
              setSearch({
                page: 1,
                status: value === '__all__' ? undefined : (value as 'active' | 'finalized'),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os status</SelectItem>
              <SelectItem value="active">Em execução</SelectItem>
              <SelectItem value="finalized">Finalizada</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={search.frequency ?? '__all__'}
            onValueChange={(value) =>
              setSearch({
                page: 1,
                frequency:
                  value === '__all__'
                    ? undefined
                    : (value as 'weekly' | 'biweekly' | 'monthly' | 'yearly'),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Frequência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as frequências</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="biweekly">Quinzenal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={search.accountId ?? '__all__'}
            onValueChange={(value) =>
              setSearch({ page: 1, accountId: value === '__all__' ? undefined : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as contas</SelectItem>
              {(accountsQuery.data ?? []).map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setSearch({
                page: 1,
                q: undefined,
                originType: undefined,
                status: undefined,
                frequency: undefined,
                accountId: undefined,
              })
            }
          >
            Limpar filtros
          </Button>
        </div>
      </div>

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

      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_1.2fr_0.9fr_0.7fr_1fr] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Descrição</span>
          <span>Origem</span>
          <span>Frequência</span>
          <span>Conta/Categoria</span>
          <span>Próxima</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
        </div>

        {recurrencesQuery.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`recurrence-skeleton-${index}`}
                className="h-10 animate-pulse rounded bg-muted/40"
              />
            ))}
          </div>
        ) : null}

        {recurrencesQuery.isError ? (
          <div className="space-y-2 p-4 text-sm text-red-300">
            <p>{getApiErrorMessage(recurrencesQuery.error)}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void recurrencesQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {!recurrencesQuery.isLoading &&
        !recurrencesQuery.isError &&
        (recurrencesQuery.data?.data.length ?? 0) === 0 ? (
          <div className="space-y-2 p-4 text-sm text-muted-foreground">
            <p>Nenhuma recorrência encontrada para os filtros informados.</p>
            <Button size="sm" variant="outline" onClick={openCreateModal}>
              <Plus className="mr-2 size-4" />
              Criar recorrência
            </Button>
          </div>
        ) : null}

        {recurrencesQuery.data?.data.map((recurrence) => (
          <div
            key={recurrence.id}
            className="grid grid-cols-[1.3fr_0.9fr_0.9fr_1.2fr_0.9fr_0.7fr_1fr] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
          >
            <div className="truncate">
              {recurrence.description || recurrence.notes || 'Sem descrição'}
            </div>
            <div>{formatOriginType(recurrence.originType)}</div>
            <div>{formatFrequency(recurrence.frequency)}</div>
            <div className="truncate">
              {formatRecurrenceTarget(recurrence, accountsById, categoriesById)}
            </div>
            <div>{formatDate(recurrence.nextOccurrenceDate)}</div>
            <div>{formatStatus(recurrence.status)}</div>
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEditModal(recurrence)}
                disabled={recurrence.status !== 'active'}
              >
                <Pencil className="size-4" />
              </Button>
              {recurrence.status === 'active' ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleFinalize(recurrence)}
                    disabled={finalizeMutation.isPending}
                  >
                    Finalizar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void handleDelete(recurrence)}
                    aria-label="Excluir (finalize primeiro para excluir)"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void handleDelete(recurrence)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm text-muted-foreground">
        <span>
          Página {page} de {totalPages} · {total} registros
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setSearch({ page: Math.max(1, page - 1) })}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setSearch({ page: Math.min(totalPages, page + 1) })}
          >
            Próxima
          </Button>
        </div>
      </div>

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
                        {dayOfWeekOptions.map((option) => (
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
                        {monthOptions.map((option) => (
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
                            {`${category.name} (${formatCategoryTypeLabel(category.type)})`}
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

function getDefaultFormValues(): RecurrenceFormData {
  const userTimezone = getUser()?.timezone
  return {
    originType: 'transaction',
    frequency: 'monthly',
    startDate: getTodayIsoDateInTimezone(userTimezone),
    dayOfWeek: '',
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

function getFormValuesFromRecurrence(recurrence: Recurrence): RecurrenceFormData {
  return {
    originType: recurrence.originType,
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
    amount: recurrence.amount.toString().replace('.', ','),
    description: recurrence.description ?? '',
    notes: recurrence.notes ?? '',
    editScope: 'all',
    occurrenceDate: recurrence.nextOccurrenceDate,
  }
}

function toCreatePayload(values: RecurrenceFormData): RecurrenceCreatePayload {
  const parsedAmount = parseCurrencyInput(values.amount)
  if (parsedAmount === null || parsedAmount <= 0) {
    throw new Error('Valor inválido.')
  }

  const common = {
    frequency: values.frequency,
    startDate: values.startDate,
    dayOfWeek: values.dayOfWeek ? Number(values.dayOfWeek) : undefined,
    dayOfMonth: values.dayOfMonth ? Number(values.dayOfMonth) : undefined,
    monthOfYear: values.monthOfYear ? Number(values.monthOfYear) : undefined,
    endType: values.endType,
    endOccurrences: values.endOccurrences
      ? Number(values.endOccurrences)
      : undefined,
    endDate: values.endDate || undefined,
    amount: parsedAmount,
    description: values.description || undefined,
    notes: values.notes || undefined,
  } as const

  if (values.originType === 'transaction') {
    return {
      originType: 'transaction',
      accountId: values.accountId || '',
      categoryId: values.categoryId || '',
      subcategoryId: values.subcategoryId || undefined,
      ...common,
    }
  }

  return {
    originType: 'transfer',
    fromAccountId: values.fromAccountId || '',
    toAccountId: values.toAccountId || '',
    ...common,
  }
}

function buildScopedUpdatePayload(
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
    description: normalizeOptionalText(values.description),
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
  addChange('dayOfMonth', scheduleCandidate.dayOfMonth ?? undefined, recurrence.dayOfMonth)
  addChange('monthOfYear', scheduleCandidate.monthOfYear ?? undefined, recurrence.monthOfYear)
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

  if (values.originType === 'transaction') {
    addChange('accountId', businessCandidate.accountId ?? undefined, recurrence.accountId)
    addChange('categoryId', businessCandidate.categoryId ?? undefined, recurrence.categoryId)
    addChange(
      'subcategoryId',
      businessCandidate.subcategoryId,
      recurrence.subcategoryId,
    )
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

function formatOriginType(originType: Recurrence['originType']) {
  return originType === 'transaction' ? 'Transação' : 'Transferência'
}

function formatFrequency(frequency: Recurrence['frequency']) {
  if (frequency === 'weekly') return 'Semanal'
  if (frequency === 'biweekly') return 'Quinzenal'
  if (frequency === 'monthly') return 'Mensal'
  return 'Anual'
}

function formatCategoryTypeLabel(type: Category['type']) {
  return type === 'income' ? 'receita' : 'despesa'
}

function formatDerivedTransactionTypeLabel(type: Category['type'] | null) {
  if (type === 'income') return 'Receita'
  if (type === 'expense') return 'Despesa'
  return 'Selecione uma categoria'
}

function formatStatus(status: Recurrence['status']) {
  return status === 'active' ? 'Em execução' : 'Finalizada'
}

function formatRecurrenceTarget(
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

function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) return '-'
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}

function compareIsoDate(a: string, b: string) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

function getRecurrenceEditErrorMessage(error: unknown) {
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

function getTodayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayIsoDateInTimezone(timezone?: string | null) {
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
