import { useMutation, useQuery } from '@tanstack/react-query'

import type { User } from '@/features/auth'
import { api } from '@/lib/api'

export type UpdateProfilePayload = {
  id: string
  name: string
  timezone: string
}

type TimezoneListResponse = {
  data: string[]
}

export function useUserTimezones(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['users-timezones'],
    queryFn: async () => {
      const response = await api.get<TimezoneListResponse>('/users/timezones')
      return response.data.data
    },
    enabled: options?.enabled,
    staleTime: 1000 * 60 * 30,
  })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async ({ id, name, timezone }: UpdateProfilePayload) => {
      const response = await api.put<User>(`/users/${id}`, { name, timezone })
      return response.data
    },
  })
}
