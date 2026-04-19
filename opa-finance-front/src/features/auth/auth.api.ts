import { useMutation } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type RegisterPayload = {
  name: string
  email: string
  timezone: string
  password: string
  confirmPassword: string
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

export type ForgotPasswordPayload = {
  email: string
}

export type ForgotPasswordResponse = {
  message: string
  resetToken?: string
}

export type ResetPasswordPayload = {
  token: string
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

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (payload: ForgotPasswordPayload) => {
      const response = await api.post<ForgotPasswordResponse>(
        '/auth/forgot-password',
        payload,
      )
      return response.data
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (payload: ResetPasswordPayload) => {
      await api.post('/auth/reset-password', payload)
    },
  })
}
