import { describe, expect, it } from 'vitest'

import {
  buildTransferCreatePayloadFromForm,
  buildTransferUpdatePayloadsFromForm,
} from '@/features/transactions'

describe('transfer-payload.mapper', () => {
  it('deve montar payload de criação de transferência', () => {
    const payload = buildTransferCreatePayloadFromForm({
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amount: '$ 123,45',
      date: '2026-04-13',
      description: '  aluguel  ',
    })

    expect(payload).toEqual({
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amount: 123.45,
      date: '2026-04-13',
      description: 'aluguel',
    })
  })

  it('deve montar payloads de atualização para despesa e receita da transferência', () => {
    const payloads = buildTransferUpdatePayloadsFromForm(
      {
        fromAccountId: 'acc-1',
        toAccountId: 'acc-2',
        amount: '$ 87,65',
        date: '2026-04-14',
        description: '  transfer edit  ',
      },
      {
        expenseId: 'tx-expense',
        incomeId: 'tx-income',
      },
    )

    expect(payloads).toEqual({
      expense: {
        id: 'tx-expense',
        payload: {
          accountId: 'acc-1',
          amount: 87.65,
          date: '2026-04-14',
          description: 'transfer edit',
        },
      },
      income: {
        id: 'tx-income',
        payload: {
          accountId: 'acc-2',
          amount: 87.65,
          date: '2026-04-14',
          description: 'transfer edit',
        },
      },
    })
  })
})
