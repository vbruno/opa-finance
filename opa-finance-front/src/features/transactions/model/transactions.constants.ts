export const TRANSACTION_TYPE_VALUES = ['income', 'expense'] as const

export const TRANSACTION_SORT_VALUES = [
  'date',
  'description',
  'account',
  'category',
  'subcategory',
  'type',
  'amount',
] as const

export const SORT_DIRECTION_VALUES = ['asc', 'desc'] as const

export const CATEGORY_TYPE_RANK: Record<string, number> = {
  income: 0,
  expense: 1,
}
