import type { BaseSyntheticEvent, RefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'
import type { Category } from '@/features/categories'
import type { CategoryCreateFormData } from '@/schemas/category.schema'
import type { SubcategoryCreateFormData } from '@/schemas/subcategory.schema'

type TransactionsInlineCategoryFlowProps = {
  isCreateCategoryOpen: boolean
  isCreateSubcategoryOpen: boolean
  availableCategories: Category[]
  categoryCreateForm: UseFormReturn<CategoryCreateFormData>
  subcategoryCreateForm: UseFormReturn<SubcategoryCreateFormData>
  categoryTypeRef: RefObject<HTMLSelectElement | null>
  categoryNameRef: RefObject<HTMLInputElement | null>
  subcategoryNameRef: RefObject<HTMLInputElement | null>
  isCreateCategorySubmitting: boolean
  isCreateSubcategorySubmitting: boolean
  onCloseCreateCategory: () => void
  onCloseCreateSubcategory: () => void
  onSubmitCreateCategory: (event?: BaseSyntheticEvent) => Promise<void>
  onSubmitCreateSubcategory: (event?: BaseSyntheticEvent) => Promise<void>
}

export function TransactionsInlineCategoryFlow({
  isCreateCategoryOpen,
  isCreateSubcategoryOpen,
  availableCategories,
  categoryCreateForm,
  subcategoryCreateForm,
  categoryTypeRef,
  categoryNameRef,
  subcategoryNameRef,
  isCreateCategorySubmitting,
  isCreateSubcategorySubmitting,
  onCloseCreateCategory,
  onCloseCreateSubcategory,
  onSubmitCreateCategory,
  onSubmitCreateSubcategory,
}: TransactionsInlineCategoryFlowProps) {
  return (
    <>
      {isCreateCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fixed inset-0" onClick={onCloseCreateCategory} />
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Nova categoria</h3>
              <p className="text-sm text-muted-foreground">
                Crie uma categoria sem sair da transação.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onSubmitCreateCategory}>
              <div className="space-y-2">
                <Label htmlFor="transaction-category-new-type">Tipo</Label>
                {(() => {
                  const typeRegister = categoryCreateForm.register('type')
                  return (
                    <select
                      id="transaction-category-new-type"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      aria-invalid={!!categoryCreateForm.formState.errors.type}
                      {...typeRegister}
                      ref={(element) => {
                        typeRegister.ref(element)
                        categoryTypeRef.current = element
                      }}
                    >
                      <option value="">Selecione</option>
                      <option value="income">Receita</option>
                      <option value="expense">Despesa</option>
                    </select>
                  )
                })()}
                {categoryCreateForm.formState.errors.type && (
                  <p className="text-sm text-destructive">
                    {categoryCreateForm.formState.errors.type.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-category-new-name">Nome</Label>
                {(() => {
                  const nameRegister = categoryCreateForm.register('name')
                  return (
                    <Input
                      id="transaction-category-new-name"
                      placeholder="Ex: Alimentação"
                      className="h-10"
                      aria-invalid={!!categoryCreateForm.formState.errors.name}
                      {...nameRegister}
                      ref={(element) => {
                        nameRegister.ref(element)
                        categoryNameRef.current = element
                      }}
                    />
                  )
                })()}
                {categoryCreateForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {categoryCreateForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              {categoryCreateForm.formState.errors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {categoryCreateForm.formState.errors.root.message}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <ShortcutTooltip label="Atalho: Esc">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={onCloseCreateCategory}
                  >
                    Cancelar
                  </Button>
                </ShortcutTooltip>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={isCreateCategorySubmitting}
                >
                  {isCreateCategorySubmitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateSubcategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fixed inset-0" onClick={onCloseCreateSubcategory} />
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Nova subcategoria</h3>
              <p className="text-sm text-muted-foreground">
                Crie uma subcategoria sem sair da transação.
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={onSubmitCreateSubcategory}
            >
              <div className="space-y-2">
                <Label htmlFor="transaction-subcategory-new-category">
                  Categoria
                </Label>
                <select
                  id="transaction-subcategory-new-category"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  aria-invalid={
                    !!subcategoryCreateForm.formState.errors.categoryId
                  }
                  {...subcategoryCreateForm.register('categoryId')}
                >
                  <option value="">Selecione</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {subcategoryCreateForm.formState.errors.categoryId && (
                  <p className="text-sm text-destructive">
                    {subcategoryCreateForm.formState.errors.categoryId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-subcategory-new-name">Nome</Label>
                {(() => {
                  const nameRegister = subcategoryCreateForm.register('name')
                  return (
                    <Input
                      id="transaction-subcategory-new-name"
                      placeholder="Ex: Supermercado"
                      className="h-10"
                      aria-invalid={
                        !!subcategoryCreateForm.formState.errors.name
                      }
                      {...nameRegister}
                      ref={(element) => {
                        nameRegister.ref(element)
                        subcategoryNameRef.current = element
                      }}
                    />
                  )
                })()}
                {subcategoryCreateForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {subcategoryCreateForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              {subcategoryCreateForm.formState.errors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {subcategoryCreateForm.formState.errors.root.message}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <ShortcutTooltip label="Atalho: Esc">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={onCloseCreateSubcategory}
                  >
                    Cancelar
                  </Button>
                </ShortcutTooltip>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={isCreateSubcategorySubmitting}
                >
                  {isCreateSubcategorySubmitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
