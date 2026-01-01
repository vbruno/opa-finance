import { useMutation } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type RegisterPayload = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

export function useRegister() {
  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      await api.post('/auth/register', payload)
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: ChangePasswordPayload) => {
      await api.post('/auth/change-password', payload)
    },
  })
}
