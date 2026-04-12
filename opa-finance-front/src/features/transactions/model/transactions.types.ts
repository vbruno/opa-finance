import type { ControllerRenderProps } from 'react-hook-form'

import type { TransactionCreateFormData } from '@/schemas/transaction.schema'

export type SetTransactionAmountValue = ControllerRenderProps<
  TransactionCreateFormData,
  'amount'
>['onChange']
