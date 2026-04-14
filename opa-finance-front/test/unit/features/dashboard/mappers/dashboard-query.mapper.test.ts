import { describe, expect, it } from 'vitest'

import {
  buildDashboardBaseQueryParams,
  buildDashboardRecentTransactionsQueryParams,
  buildDashboardSummaryQueryParams,
  buildDashboardTopCategoriesQueryParams,
  buildDashboardTopCategoryTransactionsQueryParams,
} from '@/features/dashboard/mappers/dashboard-query.mapper'

describe('dashboard-query.mapper', () => {
  it('deve montar base query com accountId quando nao for all', () => {
    const base = buildDashboardBaseQueryParams({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      isAccountParamAll: false,
      resolvedAccountId: 'acc-1',
    })

    expect(base).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      accountId: 'acc-1',
      excludeHiddenAccounts: true,
    })
  })

  it('deve remover accountId da base query quando all', () => {
    const base = buildDashboardBaseQueryParams({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      isAccountParamAll: true,
      resolvedAccountId: 'acc-1',
    })

    expect(base.accountId).toBeUndefined()
    expect(base.excludeHiddenAccounts).toBe(true)
  })

  it('deve montar queries derivadas com ordenacao e limites esperados', () => {
    const base = buildDashboardBaseQueryParams({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      isAccountParamAll: false,
      resolvedAccountId: 'acc-1',
    })

    expect(buildDashboardSummaryQueryParams(base)).toMatchObject(base)
    expect(buildDashboardRecentTransactionsQueryParams(base)).toMatchObject({
      ...base,
      page: 1,
      limit: 5,
      sort: 'date',
      dir: 'desc',
    })
  })

  it('deve montar top categories por tipo/groupBy', () => {
    const base = buildDashboardBaseQueryParams({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      isAccountParamAll: false,
      resolvedAccountId: 'acc-1',
    })

    expect(
      buildDashboardTopCategoriesQueryParams(base, {
        type: 'expense',
        groupBy: 'subcategory',
      }),
    ).toMatchObject({
      ...base,
      type: 'expense',
      groupBy: 'subcategory',
    })
  })

  it('deve mapear top category selecionada para categoryId/subcategoryId corretamente', () => {
    const base = buildDashboardBaseQueryParams({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      isAccountParamAll: false,
      resolvedAccountId: 'acc-1',
    })

    expect(
      buildDashboardTopCategoryTransactionsQueryParams(base, {
        id: 'cat-1',
        groupBy: 'category',
        type: 'expense',
      }),
    ).toMatchObject({
      ...base,
      categoryId: 'cat-1',
      subcategoryId: undefined,
      type: 'expense',
      page: 1,
      limit: 5,
      sort: 'date',
      dir: 'desc',
    })

    expect(
      buildDashboardTopCategoryTransactionsQueryParams(base, {
        id: 'sub-1',
        groupBy: 'subcategory',
        type: 'income',
      }),
    ).toMatchObject({
      ...base,
      categoryId: undefined,
      subcategoryId: 'sub-1',
      type: 'income',
    })
  })
})
