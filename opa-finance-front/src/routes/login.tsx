import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useState } from 'react'

import { logout, setAuth } from '@/auth/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<
    Partial<Record<keyof LoginFormData, string>>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Limpa erro do campo quando usuário começa a digitar
    if (errors[name as keyof LoginFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
    if (apiError) {
      setApiError(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError(null)

    // Validação com Zod
    const result = loginSchema.safeParse(formData)

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LoginFormData, string>> = {}
      result.error.errors.forEach((error) => {
        if (error.path[0]) {
          fieldErrors[error.path[0] as keyof LoginFormData] = error.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    setIsLoading(true)

    try {
      // Faz login na API
      const response = await api.post<{ accessToken: string }>('/auth/login', {
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
        // Atualiza com dados completos do usuário
        setAuth(accessToken, userResponse.data)
      } catch (meError) {
        // Se falhar, limpa sessão para evitar estado inconsistente
        logout()
        throw meError
      }

      // Redireciona para o app
      navigate({ to: '/app' })
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response?: {
            status?: number
            data?: {
              detail?: string
              title?: string
            }
          }
        }

        const status = axiosError.response?.status
        const detail =
          axiosError.response?.data?.detail || axiosError.response?.data?.title

        if (status === 401) {
          setApiError('Email ou senha inválidos')
        } else if (status === 400) {
          setApiError(detail || 'Dados inválidos')
        } else {
          setApiError(detail || 'Erro ao fazer login. Tente novamente.')
        }
      } else {
        setApiError('Erro ao fazer login. Tente novamente.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-background p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Opa Finance</h1>
          <p className="text-sm text-muted-foreground">
            Entre com sua conta para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {apiError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}

type User = {
  id: string
  name: string
  email: string
  createdAt: string
}
