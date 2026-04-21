import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AccountsFiltersPanel } from '@/features/accounts/components/accounts-filters-panel'

describe('AccountsFiltersPanel', () => {
  it('dispara callbacks de busca, tipo e limpar filtros', () => {
    const onSearchDraftChange = vi.fn()
    const onSearchEnter = vi.fn()
    const onTypeFilterChange = vi.fn()
    const onClearFilters = vi.fn()

    render(
      <AccountsFiltersPanel
        isFiltersOpen={true}
        searchDraft="Conta"
        typeFilter=""
        hasActiveFilters={true}
        onSearchDraftChange={onSearchDraftChange}
        onSearchEnter={onSearchEnter}
        onTypeFilterChange={onTypeFilterChange}
        onClearFilters={onClearFilters}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
      target: { value: 'Conta Nova' },
    })
    fireEvent.keyDown(screen.getByPlaceholderText('Buscar por nome...'), {
      key: 'Enter',
    })
    fireEvent.change(screen.getByDisplayValue('Todos'), {
      target: { value: 'cash' },
    })
    fireEvent.click(screen.getByRole('button', { name: /limpar filtros/i }))

    expect(onSearchDraftChange).toHaveBeenCalledWith('Conta Nova')
    expect(onSearchEnter).toHaveBeenCalledWith('Conta')
    expect(onTypeFilterChange).toHaveBeenCalledWith('cash')
    expect(onClearFilters).toHaveBeenCalled()
  })
})
