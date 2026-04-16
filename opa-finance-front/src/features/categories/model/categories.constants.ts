export const CATEGORY_TYPE_VALUES = ['income', 'expense'] as const

export const CATEGORY_TYPE_LABELS: Record<
  (typeof CATEGORY_TYPE_VALUES)[number],
  string
> = {
  income: 'Receita',
  expense: 'Despesa',
}

export const CATEGORY_TYPE_OPTIONS = CATEGORY_TYPE_VALUES.map((value) => ({
  value,
  label: CATEGORY_TYPE_LABELS[value],
}))

export function isCategoryType(
  value: string,
): value is (typeof CATEGORY_TYPE_VALUES)[number] {
  return CATEGORY_TYPE_VALUES.includes(
    value as (typeof CATEGORY_TYPE_VALUES)[number],
  )
}
