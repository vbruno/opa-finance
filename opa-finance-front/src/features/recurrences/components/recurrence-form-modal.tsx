import { type UseFormReturn } from 'react-hook-form'

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
import { type Account } from '@/features/accounts'
import { type Category, type Subcategory } from '@/features/categories'
import { type Recurrence } from '@/features/recurrences'
import {
  RECURRENCE_DAY_OF_WEEK_OPTIONS,
  RECURRENCE_MONTH_OPTIONS,
} from '@/features/recurrences/model/recurrences.constants'
import {
  formatDerivedTransactionTypeLabel,
  formatRecurrenceCategoryTypeLabel,
  getTodayIsoDateInTimezone,
} from '@/features/recurrences/model/recurrences.helpers'
import { type RecurrenceFormData } from '@/schemas/recurrence.schema'

type RecurrenceFormModalProps = {
  open: boolean
  isEditing: boolean
  isSingleScopeEdit: boolean
  isAnyMutationPending: boolean
  isFormSupportDataLoading: boolean
  isSubcategoriesError: boolean
  formError: string | null
  conflictRecurrenceId: string | null
  isConflictRefetching: boolean
  editingRecurrence: Recurrence | null
  accounts: Account[]
  categories: Category[]
  subcategories: Subcategory[]
  selectedCategoryType: Category['type'] | null
  originType: RecurrenceFormData['originType']
  frequency: RecurrenceFormData['frequency']
  endType: RecurrenceFormData['endType']
  editScope: RecurrenceFormData['editScope']
  form: UseFormReturn<RecurrenceFormData>
  onClose: () => void
  onSubmit: (values: RecurrenceFormData) => Promise<void>
  onReloadAfterConflict: () => Promise<void>
  onSubcategoriesRefetch: () => void
}

export function RecurrenceFormModal({
  open,
  isEditing,
  isSingleScopeEdit,
  isAnyMutationPending,
  isFormSupportDataLoading,
  isSubcategoriesError,
  formError,
  conflictRecurrenceId,
  isConflictRefetching,
  editingRecurrence,
  accounts,
  categories,
  subcategories,
  selectedCategoryType,
  originType,
  frequency,
  endType,
  editScope,
  form,
  onClose,
  onSubmit,
  onReloadAfterConflict,
  onSubcategoriesRefetch,
}: RecurrenceFormModalProps) {
  const selectedCategoryId = form.watch('categoryId')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
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
                  form.setValue(
                    'originType',
                    value as 'transaction' | 'transfer',
                  )
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
                  form.setValue(
                    'frequency',
                    value as RecurrenceFormData['frequency'],
                  )
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
                    form.setValue(
                      'dayOfWeek',
                      value === '__none__' ? '' : value,
                    )
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
                    form.setValue(
                      'monthOfYear',
                      value === '__none__' ? '' : value,
                    )
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
                  form.setValue(
                    'endType',
                    value as RecurrenceFormData['endType'],
                  )
                }
                disabled={isSingleScopeEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Término" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Sem fim</SelectItem>
                  <SelectItem value="by_occurrences">
                    Por ocorrências
                  </SelectItem>
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
                    form.setValue(
                      'accountId',
                      value === '__none__' ? '' : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione</SelectItem>
                    {accounts.map((account) => (
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
                    form.setValue(
                      'subcategoryId',
                      value === '__none__' ? '' : value,
                    )
                  }
                  disabled={!selectedCategoryId || Boolean(isSubcategoriesError)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {subcategories.map((subcategory) => (
                      <SelectItem key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isSubcategoriesError ? (
                  <div className="mt-2 space-y-1 text-xs text-red-300">
                    <p>
                      Erro ao carregar subcategorias da categoria selecionada.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onSubcategoriesRefetch}
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
                    form.setValue(
                      'fromAccountId',
                      value === '__none__' ? '' : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione</SelectItem>
                    {accounts.map((account) => (
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
                    form.setValue(
                      'toAccountId',
                      value === '__none__' ? '' : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione</SelectItem>
                    {accounts.map((account) => (
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
              <Input
                {...form.register('description')}
                placeholder="Opcional"
              />
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
                    <SelectItem value="this_and_next">
                      Esta e próximas
                    </SelectItem>
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
                        ? getTodayIsoDateInTimezone(
                            editingRecurrence?.timezone,
                          )
                        : undefined
                    }
                    {...form.register('occurrenceDate')}
                  />
                  {editScope === 'single' ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Para ocorrência passada já materializada, faça ajuste
                      manual em Transações.
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
                    onClick={() => void onReloadAfterConflict()}
                    disabled={isConflictRefetching}
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
            <Button type="button" variant="outline" onClick={onClose}>
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
  )
}
