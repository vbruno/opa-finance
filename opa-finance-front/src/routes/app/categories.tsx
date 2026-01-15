import { zodResolver } from '@hookform/resolvers/zod'
import { useQueries, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Pencil, SlidersHorizontal, Trash2 } from 'lucide-react'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
} from '@/features/categories'
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
    type: z
      .preprocess(
        (value) => {
          const allowed = ['income', 'expense']
          if (typeof value !== 'string') {
            return undefined
          }
          return allowed.includes(value) ? value : undefined
        },
        z.enum(['income', 'expense']),
      )
      .optional(),
  }),
  component: Categories,
})

function Categories() {
  const navigate = Route.useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([])
  const [isSubCreateOpen, setIsSubCreateOpen] = useState(false)
  const [isSubEditOpen, setIsSubEditOpen] = useState(false)
  const [isSubDeleteConfirmOpen, setIsSubDeleteConfirmOpen] = useState(false)
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false)
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<Subcategory | null>(null)
  const [subcategoryParent, setSubcategoryParent] =
    useState<Category | null>(null)
  const [subDeleteError, setSubDeleteError] = useState<string | null>(null)
  const [hasManualSearchExpandOverride, setHasManualSearchExpandOverride] =
    useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
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

  const createNameField = form.register('name')
  const editNameField = editForm.register('name')
  const subCreateNameField = subCreateForm.register('name')
  const subEditNameField = subEditForm.register('name')

  const createCategoryMutation = useCreateCategory()

  const updateCategoryMutation = useUpdateCategory()

  const deleteCategoryMutation = useDeleteCategory()

  const createSubcategoryMutation = useCreateSubcategory()

  const updateSubcategoryMutation = useUpdateSubcategory()

  const deleteSubcategoryMutation = useDeleteSubcategory()

  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  )
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
  const categoryMatchIds = useMemo(() => {
    if (!normalizedSearch.length) {
      return []
    }
    return userCategories
      .filter((category) =>
        normalizeSearch(category.name).includes(normalizedSearch),
      )
      .map((category) => category.id)
  }, [normalizedSearch, userCategories])
  const subcategoryMatchIds = useMemo(() => {
    if (!debouncedNormalizedSearch.length) {
      return []
    }
    return userCategories
      .filter((category) => {
        const subcategories =
          searchSubcategoriesQuery.data?.[category.id] ?? []
        return subcategories.some((subcategory) =>
          normalizeSearch(subcategory.name).includes(debouncedNormalizedSearch),
        )
      })
      .map((category) => category.id)
  }, [
    debouncedNormalizedSearch,
    searchSubcategoriesQuery.data,
    userCategories,
  ])
  const searchExpandIds = useMemo(() => {
    if (!normalizedSearch.length) {
      return []
    }
    return Array.from(new Set([...categoryMatchIds, ...subcategoryMatchIds]))
  }, [categoryMatchIds, normalizedSearch, subcategoryMatchIds])
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

  const openCategoryCreate = useCallback(() => {
    form.reset()
    setIsCreateOpen(true)
  }, [form])

  const openSubcategoryCreate = useCallback(() => {
    if (isMutating || userCategories.length === 0) {
      return
    }
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
  }, [
    categories,
    isMutating,
    primaryExpandedCategoryId,
    subCreateForm,
    userCategories,
  ])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault()
        openCategoryCreate()
      }

      if (event.key === 's' || event.key === 'S') {
        event.preventDefault()
        openSubcategoryCreate()
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [openCategoryCreate, openSubcategoryCreate])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Categorias</h2>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant={hasActiveFilters || isFiltersOpen ? 'secondary' : 'outline'}
            size="icon"
            className="h-10 w-10 sm:hidden"
            aria-label={isFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            onClick={() => setIsFiltersOpen((prev) => !prev)}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
          <div className="relative">
            <Button
              variant="default"
              className="h-10"
              aria-haspopup="menu"
              aria-expanded={isCreateMenuOpen}
              onClick={() => setIsCreateMenuOpen((prev) => !prev)}
            >
              Criar
            </Button>
            {isCreateMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsCreateMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-md border bg-background p-2 shadow-lg">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    title="Atalho: C"
                    onClick={() => {
                      setIsCreateMenuOpen(false)
                      openCategoryCreate()
                    }}
                  >
                    <span className="flex flex-1 items-center justify-between">
                      Categoria
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    disabled={isMutating || userCategories.length === 0}
                    title="Atalho: S"
                    onClick={() => {
                      setIsCreateMenuOpen(false)
                      openSubcategoryCreate()
                    }}
                  >
                    <span className="flex flex-1 items-center justify-between">
                      Subcategoria
                    </span>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg border bg-card p-4 ${isFiltersOpen ? 'block' : 'hidden'
          } desktop-force-block`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <h3 className="text-base font-semibold">Filtros</h3>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="w-full sm:min-w-[220px] sm:flex-1">
              <Input
                type="text"
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      q: event.target.value.trim()
                        ? event.target.value
                        : undefined,
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
            <div className="flex w-full items-center gap-2 sm:contents">
              <div className="w-full sm:w-56">
                <div className="relative">
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
              <div className="flex h-10 items-center sm:w-auto sm:items-end sm:justify-end">
                <Button
                  variant='destructive'
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
          </div>
        </div>
      </div>

      <div className="space-y-3 mobile-only">
        {categoriesQuery.isLoading && (
          <div className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
            Carregando categorias...
          </div>
        )}
        {errorMessage && (
          <div className="rounded-lg border px-4 py-6 text-center text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        {!categoriesQuery.isLoading &&
          !errorMessage &&
          filteredCategories.map((category) => (
            <div
              key={category.id}
              className="rounded-lg border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded border text-xs text-muted-foreground transition hover:bg-muted/40 dark:border-muted-foreground/40 dark:text-muted-foreground dark:ring-1 dark:ring-muted-foreground/30 dark:hover:bg-muted/30"
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
                      className={`h-4 w-4 transition-transform duration-200 ${expandedCategoryIds.includes(category.id)
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
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Categoria
                    </p>
                    <p className="text-sm font-semibold">{category.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    className="cursor-pointer border border-amber-200 bg-amber-100 text-amber-800 hover:border-amber-300 hover:bg-amber-200 hover:brightness-95"
                    disabled={category.system}
                    aria-label="Editar categoria"
                    onClick={() => {
                      setSelectedCategory(category)
                      editForm.reset({ name: category.name })
                      setIsEditOpen(true)
                    }}
                  >
                    <Pencil className="size-5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="destructive"
                    className="cursor-pointer border border-rose-200 bg-rose-100 text-rose-700 hover:border-rose-500 hover:bg-rose-600 hover:text-rose-50 hover:shadow-sm dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200 dark:ring-1 dark:ring-rose-400/40 dark:hover:border-rose-500 dark:hover:bg-rose-500 dark:hover:text-rose-50 dark:hover:ring-rose-300"
                    disabled={category.system}
                    aria-label="Excluir categoria"
                    onClick={() => {
                      setSelectedCategory(category)
                      setDeleteError(null)
                      setIsDeleteConfirmOpen(true)
                    }}
                  >
                    <Trash2 className="size-5" />
                  </Button>
                </div>
              </div>
              <div className="mt-2">
                <span
                  className={
                    category.type === 'income'
                      ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700'
                      : 'rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700'
                  }
                >
                  {typeLabels[category.type]}
                </span>
              </div>
              {expandedCategoryIds.includes(category.id) && (
                <div className="mt-2 space-y-2">
                  {expandedQueriesById[category.id]?.isLoading && (
                    <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                      Carregando subcategorias...
                    </div>
                  )}
                  {expandedQueriesById[category.id]?.isError && (
                    <div className="rounded-md border px-3 py-2 text-sm text-destructive">
                      Erro ao carregar subcategorias. Tente novamente.
                    </div>
                  )}
                  {!expandedQueriesById[category.id]?.isLoading &&
                    !expandedQueriesById[category.id]?.isError &&
                    (expandedQueriesById[category.id]?.data ?? []).map(
                      (subcategory) => (
                        <div
                          key={subcategory.id}
                          className="rounded-md border bg-muted/10 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm">
                              <span className="text-muted-foreground">—</span>{' '}
                              {subcategory.name}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="icon-sm"
                                variant="secondary"
                                className="cursor-pointer border border-amber-200 bg-amber-100 text-amber-800 hover:border-amber-300 hover:bg-amber-200 hover:brightness-95"
                                aria-label="Editar subcategoria"
                                onClick={() => {
                                  setSubcategoryParent(category)
                                  setSelectedSubcategory(subcategory)
                                  subEditForm.reset({ name: subcategory.name })
                                  setIsSubEditOpen(true)
                                }}
                              >
                                <Pencil className="size-5" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="destructive"
                                className="cursor-pointer border border-rose-200 bg-rose-100 text-rose-700 hover:border-rose-500 hover:bg-rose-600 hover:text-rose-50 hover:shadow-sm dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200 dark:ring-1 dark:ring-rose-400/40 dark:hover:border-rose-500 dark:hover:bg-rose-500 dark:hover:text-rose-50 dark:hover:ring-rose-300"
                                aria-label="Excluir subcategoria"
                                onClick={() => {
                                  setSubcategoryParent(category)
                                  setSelectedSubcategory(subcategory)
                                  setSubDeleteError(null)
                                  setIsSubDeleteConfirmOpen(true)
                                }}
                              >
                                <Trash2 className="size-5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  {!expandedQueriesById[category.id]?.isLoading &&
                    !expandedQueriesById[category.id]?.isError &&
                    (expandedQueriesById[category.id]?.data ?? [])
                      .length === 0 && (
                      <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                        Nenhuma subcategoria cadastrada.
                      </div>
                    )}
                </div>
              )}
            </div>
          ))}
        {!categoriesQuery.isLoading &&
          !errorMessage &&
          filteredCategories.length === 0 && (
            <div className="rounded-lg border px-4 py-6 text-center">
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
            </div>
          )}
      </div>

      <div className="desktop-only">
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Categoria</th>
                <th className="w-[1%] px-4 py-3 whitespace-nowrap">Tipo</th>
                <th className="w-[1%] px-4 py-3 whitespace-nowrap">Ações</th>
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
                filteredCategories.map((category) => (
                  <Fragment key={category.id}>
                    <tr className="border-t">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border text-xs text-muted-foreground transition hover:bg-muted/40 dark:border-muted-foreground/40 dark:text-muted-foreground dark:ring-1 dark:ring-muted-foreground/30 dark:hover:bg-muted/30"
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
                              className={`h-4 w-4 transition-transform duration-200 ${expandedCategoryIds.includes(category.id)
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={
                            category.type === 'income'
                              ? 'rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700'
                              : 'rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700'
                          }
                        >
                          {typeLabels[category.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Button
                            size="icon-sm"
                            variant="secondary"
                            className="cursor-pointer border border-amber-200 bg-amber-100 text-amber-800 hover:border-amber-300 hover:bg-amber-200 hover:brightness-95"
                            disabled={category.system}
                            aria-label="Editar categoria"
                            onClick={() => {
                              setSelectedCategory(category)
                              editForm.reset({ name: category.name })
                              setIsEditOpen(true)
                            }}
                          >
                            <Pencil className="size-5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="destructive"
                            className="cursor-pointer border border-rose-200 bg-rose-100 text-rose-700 hover:border-rose-500 hover:bg-rose-600 hover:text-rose-50 hover:shadow-sm dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200 dark:ring-1 dark:ring-rose-400/40 dark:hover:border-rose-500 dark:hover:bg-rose-500 dark:hover:text-rose-50 dark:hover:ring-rose-300"
                            disabled={category.system}
                            aria-label="Excluir categoria"
                            onClick={() => {
                              setSelectedCategory(category)
                              setDeleteError(null)
                              setIsDeleteConfirmOpen(true)
                            }}
                          >
                            <Trash2 className="size-5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedCategoryIds.includes(category.id) && (
                      <>
                        {expandedQueriesById[category.id]?.isLoading && (
                          <tr className="border-t">
                            <td colSpan={3} className="px-4 py-3 text-sm text-muted-foreground">
                              Carregando subcategorias...
                            </td>
                          </tr>
                        )}
                        {expandedQueriesById[category.id]?.isError && (
                          <tr className="border-t">
                            <td colSpan={3} className="px-4 py-3 text-sm text-destructive">
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
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span
                                    className={
                                      category.type === 'income'
                                        ? 'rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700'
                                        : 'rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700'
                                    }
                                  >
                                    {typeLabels[category.type]}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <Button
                                      size="icon-sm"
                                      variant="secondary"
                                      className="cursor-pointer border border-amber-200 bg-amber-100 text-amber-800 hover:border-amber-300 hover:bg-amber-200 hover:brightness-95"
                                      aria-label="Editar subcategoria"
                                      onClick={() => {
                                        setSubcategoryParent(category)
                                        setSelectedSubcategory(subcategory)
                                        subEditForm.reset({ name: subcategory.name })
                                        setIsSubEditOpen(true)
                                      }}
                                    >
                                      <Pencil className="size-5" />
                                    </Button>
                                    <Button
                                      size="icon-sm"
                                      variant="destructive"
                                      className="cursor-pointer border border-rose-200 bg-rose-100 text-rose-700 hover:border-rose-500 hover:bg-rose-600 hover:text-rose-50 hover:shadow-sm dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200 dark:ring-1 dark:ring-rose-400/40 dark:hover:border-rose-500 dark:hover:bg-rose-500 dark:hover:text-rose-50 dark:hover:ring-rose-300"
                                      aria-label="Excluir subcategoria"
                                      onClick={() => {
                                        setSubcategoryParent(category)
                                        setSelectedSubcategory(subcategory)
                                        setSubDeleteError(null)
                                        setIsSubDeleteConfirmOpen(true)
                                      }}
                                    >
                                      <Trash2 className="size-5" />
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
                              <td colSpan={3} className="px-4 py-3 text-sm text-muted-foreground">
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
                    <td colSpan={3} className="px-4 py-10 text-center">
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
      </div>


      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsCreateOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
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
                  placeholder="Ex: Alimentação"
                  className="h-10"
                  aria-invalid={!!form.formState.errors.name}
                  {...createNameField}
                  ref={(node) => {
                    createNameField.ref(node)
                    createNameRef.current = node
                  }}
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

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={createCategoryMutation.isPending}
                >
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
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
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
                  placeholder="Ex: Alimentação"
                  className="h-10"
                  aria-invalid={!!editForm.formState.errors.name}
                  {...editNameField}
                  ref={(node) => {
                    editNameField.ref(node)
                    editNameRef.current = node
                  }}
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

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
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
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
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

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="w-full sm:w-auto"
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
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
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
                    throw new Error('Categoria não selecionada')
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
                  aria-invalid={!!subCreateForm.formState.errors.name}
                  {...subCreateNameField}
                  ref={(node) => {
                    subCreateNameField.ref(node)
                    subCreateNameRef.current = node
                  }}
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

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
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
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
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
                  aria-invalid={!!subEditForm.formState.errors.name}
                  {...subEditNameField}
                  ref={(node) => {
                    subEditNameField.ref(node)
                    subEditNameRef.current = node
                  }}
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

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
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
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
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

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsSubDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="w-full sm:w-auto"
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
