import type {
  TransactionsNavigateFn,
  TransactionsSearchParams,
} from '@/features/transactions'

import { TransactionsPageContent } from './transactions-page-content'

type TransactionsPageProps = {
  search: TransactionsSearchParams
  navigate: TransactionsNavigateFn
}

export function TransactionsPage({ search, navigate }: TransactionsPageProps) {
  return <TransactionsPageContent search={search} navigate={navigate} />
}
