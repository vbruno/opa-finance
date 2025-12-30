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
  type CategoryCreateFormData,
} from '@/schemas/category.schema'

export const Route = createFileRoute('/app/categories')({
  component: Categories,
})

function Categories() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

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
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
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
            </tr>
          </thead>
          <tbody>
            {categoriesQuery.isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Carregando categorias...
                  </p>
                </td>
              </tr>
            )}
            {errorMessage && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center">
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
                </tr>
              ))}
            {!categoriesQuery.isLoading &&
              !errorMessage &&
              categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center">
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
    </div>
  )
}
