import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  type CategoryCreateFormData,
  type CategoryUpdateFormData,
} from '@/schemas/category.schema'

export const Route = createFileRoute('/app/categories')({
  component: Categories,
})

function Categories() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  type Category = {
    id: string
    userId: string | null
    name: string
    type: 'income' | 'expense'
    system: boolean
    color: string | null
    createdAt: string
    updatedAt: string
  }

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get<Category[]>('/categories')
      return response.data
    },
  })

  const form = useForm<CategoryCreateFormData>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: {
      name: '',
      type: '',
    },
  })

  const editForm = useForm<CategoryUpdateFormData>({
    resolver: zodResolver(categoryUpdateSchema),
    defaultValues: {
      name: '',
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: async (formData: CategoryCreateFormData) => {
      const response = await api.post<Category>('/categories', {
        name: formData.name,
        type: formData.type,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsCreateOpen(false)
      form.reset()
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: async ({
      id,
      name,
    }: {
      id: string
      name: string
    }) => {
      const response = await api.put<Category>(`/categories/${id}`, { name })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsEditOpen(false)
      setSelectedCategory(null)
      editForm.reset()
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsDeleteConfirmOpen(false)
      setSelectedCategory(null)
      setDeleteError(null)
    },
  })

  const categories = categoriesQuery.data ?? []
  const typeLabels: Record<Category['type'], string> = {
    income: 'Receita',
    expense: 'Despesa',
  }
  const isMutating =
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    deleteCategoryMutation.isPending
  const errorMessage = categoriesQuery.isError
    ? getApiErrorMessage(categoriesQuery.error, {
        defaultMessage: 'Erro ao carregar categorias.',
      })
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Categorias</h2>
          <p className="text-sm text-muted-foreground">
            Organize suas receitas e despesas por categorias.
          </p>
        </div>

        <Button
          disabled={isMutating}
          onClick={() => {
            form.reset()
            setIsCreateOpen(true)
          }}
        >
          Nova categoria
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Categoria</th>
              <th className="w-[1%] px-4 py-3 whitespace-nowrap">Tipo</th>
              <th className="w-[1%] px-4 py-3 whitespace-nowrap">Origem</th>
              <th className="w-[1%] px-4 py-3 whitespace-nowrap">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {categoriesQuery.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Carregando categorias...
                  </p>
                </td>
              </tr>
            )}
            {errorMessage && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </td>
              </tr>
            )}
            {!categoriesQuery.isLoading &&
              !errorMessage &&
              categories.map((category) => (
                <tr key={category.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{category.name}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {typeLabels[category.type]}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {category.system ? 'Sistema' : 'Usuario'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={category.system}
                        onClick={() => {
                          setSelectedCategory(category)
                          editForm.reset({ name: category.name })
                          setIsEditOpen(true)
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={category.system}
                        onClick={() => {
                          setSelectedCategory(category)
                          setDeleteError(null)
                          setIsDeleteConfirmOpen(true)
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            {!categoriesQuery.isLoading &&
              !errorMessage &&
              categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Nenhuma categoria cadastrada ainda.
                      </p>
                      <Button size="sm" disabled={isMutating}>
                        Criar categoria
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsCreateOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Criar categoria</h3>
                <p className="text-sm text-muted-foreground">
                  Defina o nome e o tipo da categoria.
                </p>
              </div>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={form.handleSubmit(async (formData) => {
                try {
                  await createCategoryMutation.mutateAsync(formData)
                } catch (error: unknown) {
                  form.setError('root', {
                    message: getApiErrorMessage(error, {
                      defaultMessage:
                        'Erro ao criar categoria. Tente novamente.',
                    }),
                  })
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="category-name">Nome</Label>
                <Input
                  id="category-name"
                  placeholder="Ex: Alimentacao"
                  className="h-10"
                  aria-invalid={!!form.formState.errors.name}
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-type">Tipo</Label>
                <select
                  id="category-type"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  aria-invalid={!!form.formState.errors.type}
                  {...form.register('type')}
                >
                  <option value="">Selecione</option>
                  <option value="income">Receita</option>
                  <option value="expense">Despesa</option>
                </select>
                {form.formState.errors.type && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.type.message}
                  </p>
                )}
              </div>

              {form.formState.errors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {form.formState.errors.root.message}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={createCategoryMutation.isPending}>
                  {createCategoryMutation.isPending
                    ? 'Criando...'
                    : 'Criar categoria'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOpen && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsEditOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Editar categoria</h3>
                <p className="text-sm text-muted-foreground">
                  Atualize o nome da categoria selecionada.
                </p>
              </div>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={editForm.handleSubmit(async (formData) => {
                try {
                  await updateCategoryMutation.mutateAsync({
                    id: selectedCategory.id,
                    name: formData.name,
                  })
                } catch (error: unknown) {
                  editForm.setError('root', {
                    message: getApiErrorMessage(error, {
                      defaultMessage:
                        'Erro ao atualizar categoria. Tente novamente.',
                    }),
                  })
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="category-edit-name">Nome</Label>
                <Input
                  id="category-edit-name"
                  placeholder="Ex: Alimentacao"
                  className="h-10"
                  aria-invalid={!!editForm.formState.errors.name}
                  {...editForm.register('name')}
                />
                {editForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              {editForm.formState.errors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {editForm.formState.errors.root.message}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={updateCategoryMutation.isPending}
                >
                  {updateCategoryMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsDeleteConfirmOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Excluir categoria</h3>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir "{selectedCategory.name}"?
              </p>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  setDeleteError(null)
                  try {
                    await deleteCategoryMutation.mutateAsync(
                      selectedCategory.id,
                    )
                  } catch (error: unknown) {
                    setDeleteError(
                      getApiErrorMessage(error, {
                        defaultMessage:
                          'Erro ao excluir categoria. Tente novamente.',
                      }),
                    )
                  }
                }}
                disabled={deleteCategoryMutation.isPending}
              >
                {deleteCategoryMutation.isPending
                  ? 'Excluindo...'
                  : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
