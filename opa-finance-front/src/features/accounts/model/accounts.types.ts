import type {
  ACCOUNTS_SORT_DIRECTION_VALUES,
  ACCOUNTS_SORT_VALUES,
  ACCOUNT_TYPE_VALUES,
} from '@/features/accounts/model/accounts.constants'

export type AccountType = (typeof ACCOUNT_TYPE_VALUES)[number]
export type AccountsSortKey = (typeof ACCOUNTS_SORT_VALUES)[number] | null
export type AccountsSortDirection =
  (typeof ACCOUNTS_SORT_DIRECTION_VALUES)[number]

export type AccountsSearchParams = {
  q?: string
  type?: AccountType
  id?: string
  sort?: Exclude<AccountsSortKey, null>
  dir?: AccountsSortDirection
  page?: number
}

type AccountsNavigateSearch = {
  search: (previous: AccountsSearchParams) => AccountsSearchParams
  replace?: boolean
}

export type AccountsNavigateFn = (options: AccountsNavigateSearch) => void
