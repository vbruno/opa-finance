import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DashboardSummaryCards } from '@/features/dashboard/components/dashboard-summary-cards'

describe('DashboardSummaryCards', () => {
  it('deve exibir skeleton quando loading ativo', () => {
    const { container } = render(
      <DashboardSummaryCards showSummarySkeleton summary={undefined} />,
    )

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('deve exibir valores formatados quando houver summary', () => {
    render(
      <DashboardSummaryCards
        showSummarySkeleton={false}
        summary={{ income: 1000, expense: 300, balance: 700 }}
      />,
    )

    expect(screen.getByText('Receitas')).toBeInTheDocument()
    expect(screen.getByText('Despesas')).toBeInTheDocument()
    expect(screen.getByText('Saldo')).toBeInTheDocument()
    expect(screen.getByText('1.000,00')).toBeInTheDocument()
    expect(screen.getByText('300,00')).toBeInTheDocument()
    expect(screen.getByText('700,00')).toBeInTheDocument()
  })
})
