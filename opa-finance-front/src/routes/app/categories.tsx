import { zodResolver } from '@hookform/resolvers/zod'
import { useQueries, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchSubcategories,
  useCategories,
  useCreateCategory,
  useCreateSubcategory,
  useDeleteCategory,
  useDeleteSubcategory,
  useUpdateCategory,
  useUpdateSubcategory,
  type Category,
  type Subcategory,
} from '@/features/categories/categories.api'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  type CategoryCreateFormData,
  type CategoryUpdateFormData,
} from '@/schemas/category.schema'
import {
  subcategoryCreateSchema,
  subcategoryUpdateSchema,
  type SubcategoryCreateFormData,
  type SubcategoryUpdateFormData,
} from '@/schemas/subcategory.schema'

export const Route = createFileRoute('/app/categories')({
  validateSearch: z.object({
    q: z.string().optional(),
    type: z.preprocess(
      (value) => {
        const allowed = ['income', 'expense']
        if (typeof value !== 'string') {
          return undefined
        }
        return allowed.includes(value) ? value : undefined
      },
      z.enum(['income', 'expense']).optional(),
    ),
  }),
  component: Categories,
})

function Categories() {
  const navigate = useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([])
  const [isSubCreateOpen, setIsSubCreateOpen] = useState(false)
  const [isSubEditOpen, setIsSubEditOpen] = useState(false)
  const [isSubDeleteConfirmOpen, setIsSubDeleteConfirmOpen] = useState(false)
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<Subcategory | null>(null)
  const [subcategoryParent, setSubcategoryParent] =
    useState<Category | null>(null)
  const [subDeleteError, setSubDeleteError] = useState<string | null>(null)
  const [hasManualSearchExpandOverride, setHasManualSearchExpandOverride] =
    useState(false)
  const createNameRef = useRef<HTMLInputElement | null>(null)
  const editNameRef = useRef<HTMLInputElement | null>(null)
  const subCreateNameRef = useRef<HTMLInputElement | null>(null)
  const subEditNameRef = useRef<HTMLInputElement | null>(null)

  const categoriesQuery = useCategories()

  const expandedSubcategoriesQueries = useQueries({
    queries: expandedCategoryIds.map((categoryId) => ({
      queryKey: ['subcategories', categoryId],
      queryFn: () => fetchSubcategories(categoryId),
    })),
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

  const subCreateForm = useForm<SubcategoryCreateFormData>({
    resolver: zodResolver(subcategoryCreateSchema),
    defaultValues: {
      name: '',
    },
  })

  const subEditForm = useForm<SubcategoryUpdateFormData>({
    resolver: zodResolver(subcategoryUpdateSchema),
    defaultValues: {
      name: '',
    },
  })

  const createCategoryMutation = useCreateCategory()

  const updateCategoryMutation = useUpdateCategory()

  const deleteCategoryMutation = useDeleteCategory()

  const createSubcategoryMutation = useCreateSubcategory()

  const updateSubcategoryMutation = useUpdateSubcategory()

  const deleteSubcategoryMutation = useDeleteSubcategory()

  const categories = categoriesQuery.data ?? []
  const search = Route.useSearch()
  const searchTerm = search.q ?? ''
  const typeFilter = search.type ?? ''
  const hasActiveFilters = !!searchTerm || !!typeFilter
  const normalizedSearch = normalizeSearch(searchTerm)
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)
  const debouncedNormalizedSearch = normalizeSearch(debouncedSearchTerm)
  const userCategories = categories.filter((category) => !category.system)
  const expandedQueriesById = Object.fromEntries(
    expandedCategoryIds.map((categoryId, index) => [
      categoryId,
      expandedSubcategoriesQueries[index],
    ]),
  ) as Record<
    string,
    {
      data?: Subcategory[]
      isLoading: boolean
      isError: boolean
    }
  >
  const primaryExpandedCategoryId = expandedCategoryIds[0] ?? null
  const userCategoryIdsKey = userCategories
    .map((category) => category.id)
    .join(',')
  const searchSubcategoriesQuery = useQuery({
    queryKey: ['subcategories', 'search', userCategoryIdsKey],
    queryFn: async () => {
      const entries = await Promise.all(
        userCategories.map(async (category) => {
          const data = await fetchSubcategories(category.id)
          return [category.id, data] as const
        }),
      )
      return Object.fromEntries(entries) as Record<string, Subcategory[]>
    },
    enabled:
      debouncedNormalizedSearch.length > 0 && userCategories.length > 0,
  })
  const filteredCategories = userCategories.filter((category) => {
    const matchesName = normalizedSearch
      ? normalizeSearch(category.name).includes(normalizedSearch)
      : true
    const subcategories = searchSubcategoriesQuery.data?.[category.id] ?? []
    const matchesSubcategory =
      debouncedNormalizedSearch.length > 0 &&
      subcategories.some((subcategory) =>
        normalizeSearch(subcategory.name).includes(debouncedNormalizedSearch),
      )
    const matchesType = typeFilter ? category.type === typeFilter : true
    return (matchesName || matchesSubcategory) && matchesType
  })
  const categoryMatchIds = normalizedSearch.length
    ? userCategories
        .filter((category) =>
          normalizeSearch(category.name).includes(normalizedSearch),
        )
        .map((category) => category.id)
    : []
  const subcategoryMatchIds = debouncedNormalizedSearch.length
    ? userCategories
        .filter((category) => {
          const subcategories =
            searchSubcategoriesQuery.data?.[category.id] ?? []
          return subcategories.some((subcategory) =>
            normalizeSearch(subcategory.name).includes(debouncedNormalizedSearch),
          )
        })
        .map((category) => category.id)
    : []
  const searchExpandIds = normalizedSearch.length
    ? Array.from(new Set([...categoryMatchIds, ...subcategoryMatchIds]))
    : []
  const typeLabels: Record<Category['type'], string> = {
    income: 'Receita',
    expense: 'Despesa',
  }
  const isMutating =
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    deleteCategoryMutation.isPending ||
    createSubcategoryMutation.isPending ||
    updateSubcategoryMutation.isPending ||
    deleteSubcategoryMutation.isPending
  const errorMessage = categoriesQuery.isError
    ? getApiErrorMessage(categoriesQuery.error, {
        defaultMessage: 'Erro ao carregar categorias.',
      })
    : null

  useEffect(() => {
    if (!isCreateOpen) {
      return
    }
    const focusId = window.setTimeout(() => {
      createNameRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [isCreateOpen])

  useEffect(() => {
    if (!isEditOpen) {
      return
    }
    const focusId = window.setTimeout(() => {
      editNameRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [isEditOpen])

  useEffect(() => {
    if (!isSubCreateOpen) {
      return
    }
    const focusId = window.setTimeout(() => {
      subCreateNameRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [isSubCreateOpen])

  useEffect(() => {
    if (!isSubEditOpen) {
      return
    }
    const focusId = window.setTimeout(() => {
      subEditNameRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusId)
  }, [isSubEditOpen])

  useEffect(() => {
    if (expandedCategoryIds.length === 0) {
      return
    }
    const validIds = new Set(userCategories.map((category) => category.id))
    setExpandedCategoryIds((prev) => {
      const next = prev.filter((categoryId) => validIds.has(categoryId))
      return arraysEqual(prev, next) ? prev : next
    })
  }, [userCategories, expandedCategoryIds.length])

  useEffect(() => {
    if (!normalizedSearch.length) {
      if (hasManualSearchExpandOverride) {
        setHasManualSearchExpandOverride(false)
      }
      return
    }
    if (searchExpandIds.length === 0) {
      if (expandedCategoryIds.length > 0) {
        setExpandedCategoryIds([])
      }
      return
    }
    if (hasManualSearchExpandOverride) {
      return
    }
    setExpandedCategoryIds((prev) => {
      if (arraysEqual(prev, searchExpandIds)) {
        return prev
      }
      return searchExpandIds
    })
  }, [
    normalizedSearch,
    searchExpandIds,
    expandedCategoryIds.length,
    hasManualSearchExpandOverride,
  ])

  useEffect(() => {
    if (
      !isCreateOpen &&
      !isEditOpen &&
      !isDeleteConfirmOpen &&
      !isSubCreateOpen &&
      !isSubEditOpen &&
      !isSubDeleteConfirmOpen
    ) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }
      if (isSubDeleteConfirmOpen) {
        setIsSubDeleteConfirmOpen(false)
        return
      }
      if (isSubEditOpen) {
        setIsSubEditOpen(false)
        return
      }
      if (isSubCreateOpen) {
        setIsSubCreateOpen(false)
        return
      }
      if (isDeleteConfirmOpen) {
        setIsDeleteConfirmOpen(false)
        return
      }
      if (isEditOpen) {
        setIsEditOpen(false)
        return
      }
      if (isCreateOpen) {
        setIsCreateOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isCreateOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    isSubCreateOpen,
    isSubEditOpen,
    isSubDeleteConfirmOpen,
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Categorias</h2>
          <p className="text-sm text-muted-foreground">
            Organize suas receitas e despesas por categorias.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={isMutating || userCategories.length === 0}
            onClick={() => {
              if (primaryExpandedCategoryId) {
                const parent = categories.find(
                  (category) => category.id === primaryExpandedCategoryId,
                )
                if (parent) {
                  setSubcategoryParent(parent)
                }
              } else {
                setSubcategoryParent(userCategories[0])
              }
              subCreateForm.reset()
              setIsSubCreateOpen(true)
            }}
          >
            Nova subcategoria
          </Button>
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
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Buscar
          </label>
          <Input
            type="text"
            placeholder="Buscar por nome..."
            className="mt-2 h-10"
            value={searchTerm}
            onChange={(event) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  q: event.target.value.trim() ? event.target.value : undefined,
                }),
                replace: true,
              })
            }
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return
              }
              navigate({
                search: (prev) => ({
                  ...prev,
                  q: event.currentTarget.value.trim()
                    ? event.currentTarget.value
                    : undefined,
                }),
                replace: false,
              })
            }}
          />
        </div>
        <div className="w-full sm:w-56">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Tipo
          </label>
          <div className="relative mt-2">
            <select
              className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-10 text-sm"
              value={typeFilter}
              onChange={(event) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    type: event.target.value || undefined,
                  }),
                  replace: false,
                })
              }
            >
              <option value="">Todos</option>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M4 6l4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
        <div className="flex h-10 items-end">
          <Button
            variant="outline"
            size="icon"
            disabled={!hasActiveFilters}
            aria-label="Limpar filtros"
            className="h-10 w-10"
            onClick={() => {
              navigate({
                search: () => ({}),
                replace: false,
              })
            }}
          >
            x
          </Button>
        </div>
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
              filteredCategories.map((category) => (
                <Fragment key={category.id}>
                  <tr className="border-t">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded border text-xs text-muted-foreground transition hover:bg-muted/40"
                          aria-label={
                            expandedCategoryIds.includes(category.id)
                              ? 'Ocultar subcategorias'
                              : 'Mostrar subcategorias'
                          }
                          aria-expanded={expandedCategoryIds.includes(category.id)}
                          onClick={() => {
                            if (normalizedSearch.length > 0) {
                              setHasManualSearchExpandOverride(true)
                            }
                            setExpandedCategoryIds((prev) =>
                              prev.includes(category.id)
                                ? prev.filter((id) => id !== category.id)
                                : [...prev, category.id],
                            )
                          }}
                        >
                          <svg
                            viewBox="0 0 16 16"
                            className={`h-4 w-4 transition-transform duration-200 ${
                              expandedCategoryIds.includes(category.id)
                                ? 'rotate-90'
                                : ''
                            }`}
                            aria-hidden="true"
                          >
                            <path
                              d="M6 4l4 4-4 4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        {category.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {typeLabels[category.type]}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <span
                        className={
                          category.system
                            ? 'rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700'
                            : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700'
                        }
                      >
                        {category.system ? 'Sistema' : 'Usuario'}
                      </span>
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
                  {expandedCategoryIds.includes(category.id) && (
                    <>
                      {expandedQueriesById[category.id]?.isLoading && (
                        <tr className="border-t">
                          <td colSpan={4} className="px-4 py-3 text-sm text-muted-foreground">
                            Carregando subcategorias...
                          </td>
                        </tr>
                      )}
                      {expandedQueriesById[category.id]?.isError && (
                        <tr className="border-t">
                          <td colSpan={4} className="px-4 py-3 text-sm text-destructive">
                            Erro ao carregar subcategorias. Tente novamente.
                          </td>
                        </tr>
                      )}
                      {!expandedQueriesById[category.id]?.isLoading &&
                        !expandedQueriesById[category.id]?.isError &&
                        (expandedQueriesById[category.id]?.data ?? []).map(
                          (subcategory) => (
                          <tr key={subcategory.id} className="border-t bg-muted/10">
                            <td className="px-4 py-3 text-sm">
                              <span className="text-muted-foreground">—</span>{' '}
                              {subcategory.name}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {typeLabels[category.type]}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                Subcategoria
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSubcategoryParent(category)
                                    setSelectedSubcategory(subcategory)
                                    subEditForm.reset({ name: subcategory.name })
                                    setIsSubEditOpen(true)
                                  }}
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSubcategoryParent(category)
                                    setSelectedSubcategory(subcategory)
                                    setSubDeleteError(null)
                                    setIsSubDeleteConfirmOpen(true)
                                  }}
                                >
                                  Excluir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ),
                        )}
                      {!expandedQueriesById[category.id]?.isLoading &&
                        !expandedQueriesById[category.id]?.isError &&
                        (expandedQueriesById[category.id]?.data ?? [])
                          .length === 0 && (
                          <tr className="border-t">
                            <td colSpan={4} className="px-4 py-3 text-sm text-muted-foreground">
                              Nenhuma subcategoria cadastrada.
                            </td>
                          </tr>
                        )}
                    </>
                  )}
                </Fragment>
              ))}
            {!categoriesQuery.isLoading &&
              !errorMessage &&
              filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <div className="space-y-2">
                      {userCategories.length === 0 ? (
                        <>
                          <p className="text-sm font-medium">
                            Nenhuma categoria cadastrada ainda.
                          </p>
                          <Button
                            size="sm"
                            disabled={isMutating}
                            onClick={() => {
                              form.reset()
                              setIsCreateOpen(true)
                            }}
                          >
                            Criar categoria
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm font-medium">
                          Nenhuma categoria encontrada com os filtros atuais.
                        </p>
                      )}
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
                  await createCategoryMutation.mutateAsync({
                    name: formData.name,
                    type: formData.type,
                  })
                  setIsCreateOpen(false)
                  form.reset()
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
                  ref={createNameRef}
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
                  setIsEditOpen(false)
                  setSelectedCategory(null)
                  editForm.reset()
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
                  ref={editNameRef}
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
                    setIsDeleteConfirmOpen(false)
                    setSelectedCategory(null)
                    setDeleteError(null)
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

      {isSubCreateOpen && subcategoryParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsSubCreateOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Criar subcategoria</h3>
                <p className="text-sm text-muted-foreground">
                  Categoria: {subcategoryParent.name}
                </p>
              </div>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={subCreateForm.handleSubmit(async (formData) => {
                try {
                  if (!subcategoryParent) {
                    throw new Error('Categoria nao selecionada')
                  }
                  await createSubcategoryMutation.mutateAsync({
                    categoryId: subcategoryParent.id,
                    name: formData.name,
                  })
                  setIsSubCreateOpen(false)
                  subCreateForm.reset()
                } catch (error: unknown) {
                  subCreateForm.setError('root', {
                    message: getApiErrorMessage(error, {
                      defaultMessage:
                        'Erro ao criar subcategoria. Tente novamente.',
                    }),
                  })
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="subcategory-parent">Categoria</Label>
                <select
                  id="subcategory-parent"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={subcategoryParent.id}
                  onChange={(event) => {
                    const nextParent = userCategories.find(
                      (category) => category.id === event.target.value,
                    )
                    if (nextParent) {
                      setSubcategoryParent(nextParent)
                    }
                  }}
                >
                  {userCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcategory-name">Nome</Label>
                <Input
                  id="subcategory-name"
                  placeholder="Ex: Supermercado"
                  className="h-10"
                  ref={subCreateNameRef}
                  aria-invalid={!!subCreateForm.formState.errors.name}
                  {...subCreateForm.register('name')}
                />
                {subCreateForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {subCreateForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              {subCreateForm.formState.errors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {subCreateForm.formState.errors.root.message}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={createSubcategoryMutation.isPending}
                >
                  {createSubcategoryMutation.isPending
                    ? 'Criando...'
                    : 'Criar subcategoria'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSubEditOpen && selectedSubcategory && subcategoryParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsSubEditOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Editar subcategoria</h3>
                <p className="text-sm text-muted-foreground">
                  Categoria: {subcategoryParent.name}
                </p>
              </div>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={subEditForm.handleSubmit(async (formData) => {
                try {
                  await updateSubcategoryMutation.mutateAsync({
                    id: selectedSubcategory.id,
                    name: formData.name,
                    categoryId: subcategoryParent.id,
                  })
                  setIsSubEditOpen(false)
                  setSelectedSubcategory(null)
                  subEditForm.reset()
                } catch (error: unknown) {
                  subEditForm.setError('root', {
                    message: getApiErrorMessage(error, {
                      defaultMessage:
                        'Erro ao atualizar subcategoria. Tente novamente.',
                    }),
                  })
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="subcategory-edit-name">Nome</Label>
                <Input
                  id="subcategory-edit-name"
                  placeholder="Ex: Supermercado"
                  className="h-10"
                  ref={subEditNameRef}
                  aria-invalid={!!subEditForm.formState.errors.name}
                  {...subEditForm.register('name')}
                />
                {subEditForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {subEditForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              {subEditForm.formState.errors.root?.message && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {subEditForm.formState.errors.root.message}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={updateSubcategoryMutation.isPending}
                >
                  {updateSubcategoryMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSubDeleteConfirmOpen && selectedSubcategory && subcategoryParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsSubDeleteConfirmOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Excluir subcategoria</h3>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir "{selectedSubcategory.name}"?
              </p>
            </div>

            {subDeleteError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {subDeleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsSubDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  setSubDeleteError(null)
                  try {
                    await deleteSubcategoryMutation.mutateAsync(
                      {
                        id: selectedSubcategory.id,
                        categoryId: subcategoryParent.id,
                      },
                    )
                    setIsSubDeleteConfirmOpen(false)
                    setSelectedSubcategory(null)
                    setSubDeleteError(null)
                  } catch (error: unknown) {
                    setSubDeleteError(
                      getApiErrorMessage(error, {
                        defaultMessage:
                          'Erro ao excluir subcategoria. Tente novamente.',
                      }),
                    )
                  }
                }}
                disabled={deleteSubcategoryMutation.isPending}
              >
                {deleteSubcategoryMutation.isPending
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

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)
    return () => window.clearTimeout(timeoutId)
  }, [value, delayMs])

  return debouncedValue
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}
