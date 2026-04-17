import type { User } from '@/features/auth'
import { PROFILE_DEFAULT_TIMEZONE } from '@/features/profile/model/profile.constants'
import type { ProfileFormValues } from '@/features/profile/model/profile.types'
export function buildUpdateProfilePayload(input: {
  userId: string
  values: ProfileFormValues
}) {
  return {
    id: input.userId,
    name: input.values.name,
    timezone: input.values.timezone,
  }
}

export function toProfileFormValues(user: User | null): ProfileFormValues {
  return {
    name: user?.name ?? '',
    timezone: user?.timezone ?? PROFILE_DEFAULT_TIMEZONE,
  }
}
