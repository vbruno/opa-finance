import { describe, expect, it } from 'vitest'

import {
  filterAccounts,
  isRecurrenceConflictMessage,
  normalizeAccountsSearch,
  paginateAccounts,
  sortAccounts,
} from '@/features/accounts/model/accounts.helpers'

const accountsFixture = [
  {
    id: 'a-1',
    name: 'Conta Principal',
    type: 'checking_account',
    currentBalance: 300,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'a-2',
    name: 'Poupança',
    type: 'savings_account',
    currentBalance: 150,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'a-3',
    name: 'Cartão XPTO',
    type: 'credit_card',
    currentBalance: -50,
    createdAt: '',
    updatedAt: '',
  },
]

describe('accounts.helpers', () => {
  it('normaliza texto para busca sem acento', () => {
    expect(normalizeAccountsSearch('  Poupânça  ')).toBe('poupanca')
  })

  it('filtra por texto e tipo', () => {
    const byText = filterAccounts(accountsFixture, 'cartao', '')
    const byType = filterAccounts(accountsFixture, '', 'savings_account')

    expect(byText).toHaveLength(1)
    expect(byText[0].id).toBe('a-3')
    expect(byType).toHaveLength(1)
    expect(byType[0].id).toBe('a-2')
  })

  it('ordena por saldo e por tipo', () => {
    const labels = {
      checking_account: 'Conta Corrente',
      savings_account: 'Poupança',
      credit_card: 'Cartão de Crédito',
    }
    const byBalanceAsc = sortAccounts(accountsFixture, 'balance', 'asc', labels)
    const byTypeDesc = sortAccounts(accountsFixture, 'type', 'desc', labels)

    expect(byBalanceAsc.map((account) => account.id)).toEqual([
      'a-3',
      'a-2',
      'a-1',
    ])
    expect(byTypeDesc[0].id).toBe('a-2')
  })

  it('pagina resultados mantendo safePage', () => {
    const paginated = paginateAccounts(accountsFixture, 3, 2)

    expect(paginated.totalPages).toBe(2)
    expect(paginated.safePage).toBe(2)
    expect(paginated.paginatedAccounts).toHaveLength(1)
    expect(paginated.paginatedAccounts[0].id).toBe('a-3')
  })

  it('detecta conflito de recorrência na mensagem', () => {
    expect(
      isRecurrenceConflictMessage(
        'Conta não pode ser ocultada: recorrência ativa vinculada.',
      ),
    ).toBe(true)
    expect(isRecurrenceConflictMessage('Erro genérico')).toBe(false)
  })
})
