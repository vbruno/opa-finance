import type {
  TransactionsNavigateFn,
  TransactionsSearchParams,
} from '@/features/transactions'

import { TransactionsPageContentBody } from './transactions-page-content-body'

type TransactionsPageProps = {
  search: TransactionsSearchParams
  navigate: TransactionsNavigateFn
}

export function TransactionsPageContent(props: TransactionsPageProps) {
  return <TransactionsPageContentBody {...props} />
}
