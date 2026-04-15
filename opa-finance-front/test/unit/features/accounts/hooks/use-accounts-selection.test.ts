import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAccountsSelection } from '@/features/accounts/hooks/use-accounts-selection'

const accountsFixture = [
  {
    id: 'a-1',
    name: 'Conta A',
    type: 'checking_account',
    currentBalance: 100,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'a-2',
    name: 'Conta B',
    type: 'savings_account',
    currentBalance: 50,
    createdAt: '',
    updatedAt: '',
  },
]

describe('useAccountsSelection', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('seleciona contas e calcula subtotal', () => {
    const { result } = renderHook(() =>
      useAccountsSelection({
        accounts: accountsFixture,
        filteredAccounts: accountsFixture,
        paginatedAccounts: accountsFixture,
        normalizedSearch: '',
        typeFilter: '',
        hasOpenModal: false,
      }),
    )

    act(() => {
      result.current.setAccountSelected('a-1', true)
    })

    expect(result.current.selectedCount).toBe(1)
    expect(result.current.selectedTotal).toBe(100)
  })

  it('marca/desmarca seleção da página', () => {
    const { result } = renderHook(() =>
      useAccountsSelection({
        accounts: accountsFixture,
        filteredAccounts: accountsFixture,
        paginatedAccounts: accountsFixture,
        normalizedSearch: '',
        typeFilter: '',
        hasOpenModal: false,
      }),
    )

    act(() => {
      result.current.toggleSelectAllOnPage(true)
    })
    expect(result.current.allSelectedOnPage).toBe(true)

    act(() => {
      result.current.toggleSelectAllOnPage(false)
    })
    expect(result.current.selectedCount).toBe(0)
  })

  it('limpa seleção ao trocar filtro', () => {
    const { result, rerender } = renderHook(
      ({ normalizedSearch }) =>
        useAccountsSelection({
          accounts: accountsFixture,
          filteredAccounts: accountsFixture,
          paginatedAccounts: accountsFixture,
          normalizedSearch,
          typeFilter: '',
          hasOpenModal: false,
        }),
      { initialProps: { normalizedSearch: '' } },
    )

    act(() => {
      result.current.setAccountSelected('a-1', true)
    })
    expect(result.current.selectedCount).toBe(1)

    rerender({ normalizedSearch: 'nova-busca' })
    expect(result.current.selectedCount).toBe(0)
  })
})
