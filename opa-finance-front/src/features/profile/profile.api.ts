import { useMutation } from '@tanstack/react-query'

import type { User } from '@/features/auth'
import { api } from '@/lib/api'

export type UpdateProfilePayload = {
  id: string
  name: string
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async ({ id, name }: UpdateProfilePayload) => {
      const response = await api.put<User>(`/users/${id}`, { name })
      return response.data
    },
  })
}
