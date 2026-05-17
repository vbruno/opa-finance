import { useCallback, useState } from 'react'

import type { TopCategory, TopCategoriesGroupBy } from '@/features/transactions/transactions.api'
import { useUserPreference } from '@/hooks/useUserPreference'

type TopCategorySelection = {
  id: string
  name: string
  groupBy: TopCategoriesGroupBy
  type: 'income' | 'expense'
}

export function useDashboardPanels() {
  const [isTransactionsOpen, setIsTransactionsOpen] = useUserPreference<boolean>(
    'dashboardPanelTransactionsOpen',
    true,
  )
  const [isTopExpensesOpen, setIsTopExpensesOpen] = useUserPreference<boolean>(
    'dashboardPanelTopExpensesOpen',
    false,
  )
  const [isTopIncomeOpen, setIsTopIncomeOpen] = useUserPreference<boolean>(
    'dashboardPanelTopIncomeOpen',
    false,
  )
  const [expenseGroupBy, setExpenseGroupBy] =
    useState<TopCategoriesGroupBy>('category')
  const [incomeGroupBy, setIncomeGroupBy] =
    useState<TopCategoriesGroupBy>('category')
  const [selectedTopCategory, setSelectedTopCategory] =
    useState<TopCategorySelection | null>(null)

  const toggleTransactionsOpen = useCallback(() => {
    setIsTransactionsOpen((prev) => !prev)
  }, [setIsTransactionsOpen])

  const toggleTopExpensesOpen = useCallback(() => {
    setIsTopExpensesOpen((prev) => !prev)
  }, [setIsTopExpensesOpen])

  const toggleTopIncomeOpen = useCallback(() => {
    setIsTopIncomeOpen((prev) => !prev)
  }, [setIsTopIncomeOpen])

  const updateExpenseGroupBy = useCallback((checked: boolean) => {
    setExpenseGroupBy(checked ? 'subcategory' : 'category')
  }, [])

  const updateIncomeGroupBy = useCallback((checked: boolean) => {
    setIncomeGroupBy(checked ? 'subcategory' : 'category')
  }, [])

  const selectExpenseTopCategory = useCallback(
    (item: TopCategory) => {
      const isFallbackCategory =
        expenseGroupBy === 'subcategory' &&
        item.categoryName &&
        item.name === item.categoryName
      setSelectedTopCategory({
        id: item.id,
        name: item.name,
        groupBy: isFallbackCategory ? 'category' : expenseGroupBy,
        type: 'expense',
      })
    },
    [expenseGroupBy],
  )

  const selectIncomeTopCategory = useCallback(
    (item: TopCategory) => {
      const isFallbackCategory =
        incomeGroupBy === 'subcategory' &&
        item.categoryName &&
        item.name === item.categoryName
      setSelectedTopCategory({
        id: item.id,
        name: item.name,
        groupBy: isFallbackCategory ? 'category' : incomeGroupBy,
        type: 'income',
      })
    },
    [incomeGroupBy],
  )

  const clearSelectedTopCategory = useCallback(() => {
    setSelectedTopCategory(null)
  }, [])

  return {
    isTransactionsOpen,
    isTopExpensesOpen,
    isTopIncomeOpen,
    expenseGroupBy,
    incomeGroupBy,
    selectedTopCategory,
    toggleTransactionsOpen,
    toggleTopExpensesOpen,
    toggleTopIncomeOpen,
    updateExpenseGroupBy,
    updateIncomeGroupBy,
    selectExpenseTopCategory,
    selectIncomeTopCategory,
    clearSelectedTopCategory,
    setSelectedTopCategory,
  }
}
