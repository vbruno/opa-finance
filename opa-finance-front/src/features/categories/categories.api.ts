import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type Category = {
  id: string
  userId: string | null
  name: string
  type: 'income' | 'expense'
  system: boolean
  color: string | null
  createdAt: string
  updatedAt: string
}

export type Subcategory = {
  id: string
  userId: string
  categoryId: string
  name: string
  color: string | null
  createdAt: string
  updatedAt: string
}

export type CategoryCreatePayload = {
  name: string
  type: string
}

export type CategoryUpdatePayload = {
  id: string
  name: string
}

export type SubcategoryCreatePayload = {
  categoryId: string
  name: string
}

export type SubcategoryUpdatePayload = {
  id: string
  name: string
  categoryId?: string
}

export type SubcategoryDeletePayload = {
  id: string
  categoryId?: string
}

const categoriesKey = ['categories']

export async function fetchCategories() {
  const response = await api.get<Category[]>('/categories')
  return response.data
}

export async function fetchSubcategories(categoryId: string) {
  const response = await api.get<Subcategory[]>(
    `/categories/${categoryId}/subcategories`,
  )
  return response.data
}

export function useCategories() {
  return useQuery({
    queryKey: categoriesKey,
    queryFn: fetchCategories,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CategoryCreatePayload) => {
      const response = await api.post<Category>('/categories', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKey })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: CategoryUpdatePayload) => {
      const response = await api.put<Category>(`/categories/${id}`, { name })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKey })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKey })
    },
  })
}

export function useCreateSubcategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SubcategoryCreatePayload) => {
      const response = await api.post<Subcategory>('/subcategories', payload)
      return response.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['subcategories', variables.categoryId],
      })
      queryClient.invalidateQueries({ queryKey: ['subcategories', 'search'] })
    },
  })
}

export function useUpdateSubcategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      name,
    }: SubcategoryUpdatePayload) => {
      const response = await api.put<Subcategory>(`/subcategories/${id}`, {
        name,
      })
      return response.data
    },
    onSuccess: (_data, variables) => {
      if (variables.categoryId) {
        queryClient.invalidateQueries({
          queryKey: ['subcategories', variables.categoryId],
        })
      }
      queryClient.invalidateQueries({ queryKey: ['subcategories', 'search'] })
    },
  })
}

export function useDeleteSubcategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: SubcategoryDeletePayload) => {
      await api.delete(`/subcategories/${id}`)
    },
    onSuccess: (_data, variables) => {
      if (variables.categoryId) {
        queryClient.invalidateQueries({
          queryKey: ['subcategories', variables.categoryId],
        })
      }
      queryClient.invalidateQueries({ queryKey: ['subcategories', 'search'] })
    },
  })
}
