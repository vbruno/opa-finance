import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'

import { isAuthenticated, logout, setAuth } from '@/auth/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: '/app' })
    }
  },
  component: Login,
})

function Login() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(formData: LoginFormData) {
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
          setError('root', { message: 'Email ou senha inválidos' })
        } else if (status === 400) {
          setError('root', { message: detail || 'Dados inválidos' })
        } else {
          setError('root', {
            message: detail || 'Erro ao fazer login. Tente novamente.',
          })
        }
      } else {
        setError('root', { message: 'Erro ao fazer login. Tente novamente.' })
      }
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root?.message && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
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
