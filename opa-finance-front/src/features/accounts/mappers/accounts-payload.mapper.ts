import type { AccountPayload } from '@/features/accounts/accounts.api'
import type {
  AccountCreateFormData,
  AccountUpdateFormData,
} from '@/schemas/account.schema'

export function mapCreateAccountPayload(
  formData: AccountCreateFormData,
): AccountPayload {
  return {
    name: formData.name,
    type: formData.type,
  }
}

export function mapUpdateAccountPayload(
  formData: AccountUpdateFormData,
): AccountPayload {
  return {
    name: formData.name,
    type: formData.type,
  }
}
