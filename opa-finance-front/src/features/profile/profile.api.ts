import { useMutation } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { User } from '@/features/auth'

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
