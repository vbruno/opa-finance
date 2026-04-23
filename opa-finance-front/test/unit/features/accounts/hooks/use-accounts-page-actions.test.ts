import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useAccountsPageActions } from '@/features/accounts/hooks/use-accounts-page-actions'

describe('useAccountsPageActions', () => {
  it('deve abrir modal de criação com reset do formulário', () => {
    const resetCreateForm = vi.fn()
    const openCreateModalState = vi.fn()

    const { result } = renderHook(() =>
      useAccountsPageActions({
        navigate: vi.fn(),
        safePage: 1,
        totalPages: 1,
        setPageSize: vi.fn(),
        resetCreateForm,
        openCreateModalState,
        closeEditModalState: vi.fn(),
      }),
    )

    act(() => {
      result.current.openCreateModal()
    })

    expect(resetCreateForm).toHaveBeenCalled()
    expect(openCreateModalState).toHaveBeenCalled()
  })

  it('deve fechar modal de edição e limpar id da URL', () => {
    const navigate = vi.fn()
    const closeEditModalState = vi.fn()

    const { result } = renderHook(() =>
      useAccountsPageActions({
        navigate,
        safePage: 1,
        totalPages: 1,
        setPageSize: vi.fn(),
        resetCreateForm: vi.fn(),
        openCreateModalState: vi.fn(),
        closeEditModalState,
      }),
    )

    act(() => {
      result.current.closeEditModal()
    })

    expect(closeEditModalState).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
      }),
    )
  })

  it('deve navegar e ordenar corretamente', () => {
    const navigate = vi.fn()
    const setPageSize = vi.fn()

    const { result } = renderHook(() =>
      useAccountsPageActions({
        navigate,
        safePage: 2,
        totalPages: 4,
        setPageSize,
        resetCreateForm: vi.fn(),
        openCreateModalState: vi.fn(),
        closeEditModalState: vi.fn(),
      }),
    )

    act(() => {
      result.current.handleSort('name')
      result.current.goToPreviousPage()
      result.current.goToNextPage()
      result.current.goToLastPage()
      result.current.handlePageSizeChange(20)
    })

    expect(setPageSize).toHaveBeenCalledWith(20)
    expect(navigate).toHaveBeenCalledTimes(5)
  })
})
