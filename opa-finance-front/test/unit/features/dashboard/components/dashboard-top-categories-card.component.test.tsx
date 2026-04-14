import { fireEvent, render, screen } from '@testing-library/react'
import { ArrowDownRight } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { DashboardTopCategoriesCard } from '@/features/dashboard/components/dashboard-top-categories-card'

describe('DashboardTopCategoriesCard', () => {
  it('deve alternar groupBy e selecionar item', () => {
    const onToggleGroupBySubcategory = vi.fn()
    const onSelectItem = vi.fn()

    render(
      <DashboardTopCategoriesCard
        title="Top 5 Despesas"
        icon={<ArrowDownRight className="h-6 w-6" />}
        isOpen
        groupBy="category"
        showSkeleton={false}
        errorMessage={null}
        emptyMessage="vazio"
        items={[
          {
            id: 'cat-1',
            name: 'Habitação',
            totalAmount: 500,
            percentage: 45.6,
          },
        ]}
        onToggleOpen={vi.fn()}
        onToggleGroupBySubcategory={onToggleGroupBySubcategory}
        onSelectItem={onSelectItem}
        viewAllAction={<Button size="sm">Ver todas</Button>}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /subcategoria/i }))
    fireEvent.click(screen.getByRole('button', { name: /habitação/i }))

    expect(onToggleGroupBySubcategory).toHaveBeenCalledWith(true)
    expect(onSelectItem).toHaveBeenCalledTimes(1)
  })
})
