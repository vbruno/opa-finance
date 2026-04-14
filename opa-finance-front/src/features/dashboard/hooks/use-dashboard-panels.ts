import { useCallback, useState } from 'react'

import type { TopCategory, TopCategoriesGroupBy } from '@/features/transactions/transactions.api'

type TopCategorySelection = {
  id: string
  name: string
  groupBy: TopCategoriesGroupBy
  type: 'income' | 'expense'
}

export function useDashboardPanels() {
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(true)
  const [isTopExpensesOpen, setIsTopExpensesOpen] = useState(false)
  const [isTopIncomeOpen, setIsTopIncomeOpen] = useState(false)
  const [expenseGroupBy, setExpenseGroupBy] =
    useState<TopCategoriesGroupBy>('category')
  const [incomeGroupBy, setIncomeGroupBy] =
    useState<TopCategoriesGroupBy>('category')
  const [selectedTopCategory, setSelectedTopCategory] =
    useState<TopCategorySelection | null>(null)

  const toggleTransactionsOpen = useCallback(() => {
    setIsTransactionsOpen((prev) => !prev)
  }, [])

  const toggleTopExpensesOpen = useCallback(() => {
    setIsTopExpensesOpen((prev) => !prev)
  }, [])

  const toggleTopIncomeOpen = useCallback(() => {
    setIsTopIncomeOpen((prev) => !prev)
  }, [])

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
