export const ACCOUNT_TYPE_VALUES = [
  'cash',
  'checking_account',
  'savings_account',
  'credit_card',
  'investment',
] as const

export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPE_VALUES)[number], string> =
  {
    cash: 'Dinheiro',
    checking_account: 'Conta Corrente',
    savings_account: 'Poupança',
    credit_card: 'Cartão de Crédito',
    investment: 'Investimento',
  }

export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPE_VALUES.map((value) => ({
  value,
  label: ACCOUNT_TYPE_LABELS[value],
}))

export const ACCOUNTS_SORT_VALUES = ['name', 'type', 'balance'] as const
export const ACCOUNTS_SORT_DIRECTION_VALUES = ['asc', 'desc'] as const

export function isAccountType(value: string): value is (typeof ACCOUNT_TYPE_VALUES)[number] {
  return ACCOUNT_TYPE_VALUES.includes(
    value as (typeof ACCOUNT_TYPE_VALUES)[number],
  )
}

export function isAccountsSortKey(
  value: string,
): value is (typeof ACCOUNTS_SORT_VALUES)[number] {
  return ACCOUNTS_SORT_VALUES.includes(
    value as (typeof ACCOUNTS_SORT_VALUES)[number],
  )
}

export function isAccountsSortDirection(
  value: string,
): value is (typeof ACCOUNTS_SORT_DIRECTION_VALUES)[number] {
  return ACCOUNTS_SORT_DIRECTION_VALUES.includes(
    value as (typeof ACCOUNTS_SORT_DIRECTION_VALUES)[number],
  )
}
