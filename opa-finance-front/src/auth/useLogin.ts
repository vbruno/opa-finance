import { useMutation } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { setAuth, logout } from './auth.store'

type LoginInput = {
  email: string
  password: string
}

type LoginResponse = {
  accessToken: string
}

type User = {
  id: string
  name: string
  email: string
  createdAt: string
}

export function useLogin(): UseMutationResult<void, unknown, LoginInput> {
  return useMutation({
    mutationFn: async (formData: LoginInput) => {
      const response = await api.post<LoginResponse>('/auth/login', {
        email: formData.email,
        password: formData.password,
      })

      const { accessToken } = response.data

      // Atualiza o token no store para que o interceptor possa usá-lo
      // Usa dados temporários até buscar do servidor
      setAuth(accessToken, {
        id: '',
        name: '',
        email: formData.email,
        createdAt: '',
      })

      // Busca dados completos do usuário (o interceptor já adiciona o token)
      try {
        const userResponse = await api.get<User>('/auth/me')
        setAuth(accessToken, userResponse.data)
      } catch (meError) {
        logout()
        throw meError
      }
    },
  })
}
