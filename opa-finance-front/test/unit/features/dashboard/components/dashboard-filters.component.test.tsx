import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'

describe('DashboardFilters', () => {
  it('deve acionar callback de periodo e conta', () => {
    const onPeriodChange = vi.fn()
    const onAccountChange = vi.fn()

    render(
      <DashboardFilters
        period="month"
        isAccountParamAll
        resolvedAccountId=""
        dashboardAccounts={[
          {
            id: 'a-1',
            name: 'Conta principal',
            type: 'checking_account',
            currentBalance: 0,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        customStartDate=""
        customEndDate=""
        startDate="2026-04-01"
        endDate="2026-04-30"
        isMobile={false}
        onPeriodChange={onPeriodChange}
        onAccountChange={onAccountChange}
        onCustomDateChange={vi.fn()}
        onMobileDateClick={vi.fn()}
        onMobileDateKeyDown={vi.fn()}
        onMobileDatePaste={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Período'), {
      target: { value: 'currentYear' },
    })
    fireEvent.change(screen.getByLabelText('Conta'), {
      target: { value: 'a-1' },
    })

    expect(
      screen.getByRole('option', { name: 'Mês Corrente' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Mês Anterior' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Ano Corrente' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ano Fiscal' })).toBeInTheDocument()
    expect(onPeriodChange).toHaveBeenCalledWith('currentYear')
    expect(onAccountChange).toHaveBeenCalledWith('a-1')
  })

  it('deve renderizar datas quando periodo for custom', () => {
    render(
      <DashboardFilters
        period="custom"
        isAccountParamAll={false}
        resolvedAccountId="a-1"
        dashboardAccounts={[
          {
            id: 'a-1',
            name: 'Conta principal',
            type: 'checking_account',
            currentBalance: 0,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        customStartDate="2026-04-05"
        customEndDate="2026-04-20"
        startDate="2026-04-01"
        endDate="2026-04-30"
        isMobile
        onPeriodChange={vi.fn()}
        onAccountChange={vi.fn()}
        onCustomDateChange={vi.fn()}
        onMobileDateClick={vi.fn()}
        onMobileDateKeyDown={vi.fn()}
        onMobileDatePaste={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Início')).toBeInTheDocument()
    expect(screen.getByLabelText('Fim')).toBeInTheDocument()
  })
})
