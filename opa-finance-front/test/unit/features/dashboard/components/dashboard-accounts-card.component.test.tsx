import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DashboardAccountsCard } from '@/features/dashboard/components/dashboard-accounts-card'

describe('DashboardAccountsCard', () => {
  it('deve exibir contas visíveis e permitir seleção', () => {
    const onSelectAccount = vi.fn()

    render(
      <DashboardAccountsCard
        showSkeleton={false}
        isError={false}
        errorMessage={null}
        allAccountsCount={2}
        visibleAccounts={[
          {
            id: 'a-1',
            name: 'Conta principal',
            type: 'checking_account',
            currentBalance: 300,
            isPrimary: true,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        selectedAccountId={null}
        totalBalance={300}
        accountTypeLabels={{ checking_account: 'Conta Corrente' }}
        onSelectAccount={onSelectAccount}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /conta principal/i }))
    expect(onSelectAccount).toHaveBeenCalledWith('a-1')
    expect(screen.getByText(/conta corrente/i)).toBeInTheDocument()
  })
})
