import { useCallback, useRef, useState } from 'react'

export function useAccountsPageController() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  const createNameRef = useRef<HTMLInputElement | null>(null)
  const editNameRef = useRef<HTMLInputElement | null>(null)
  const detailModalRef = useRef<HTMLDivElement | null>(null)
  const deleteModalRef = useRef<HTMLDivElement | null>(null)

  const openCreateModal = useCallback(() => setIsCreateOpen(true), [])
  const closeCreateModal = useCallback(() => setIsCreateOpen(false), [])
  const openEditModal = useCallback(() => setIsEditOpen(true), [])
  const closeEditModal = useCallback(() => setIsEditOpen(false), [])
  const openDeleteConfirmModal = useCallback(
    () => setIsDeleteConfirmOpen(true),
    [],
  )
  const closeDeleteConfirmModal = useCallback(
    () => setIsDeleteConfirmOpen(false),
    [],
  )
  const toggleFilters = useCallback(
    () => setIsFiltersOpen((previous) => !previous),
    [],
  )

  return {
    isCreateOpen,
    isEditOpen,
    isDeleteConfirmOpen,
    isFiltersOpen,
    setIsCreateOpen,
    setIsEditOpen,
    setIsDeleteConfirmOpen,
    setIsFiltersOpen,
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    openDeleteConfirmModal,
    closeDeleteConfirmModal,
    toggleFilters,
    createNameRef,
    editNameRef,
    detailModalRef,
    deleteModalRef,
  }
}
