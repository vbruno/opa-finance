import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { isAuthenticated } from '@/features/auth/auth.store'
import { useLogin } from '@/features/auth/useLogin'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/apiError'
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
  const [showPassword, setShowPassword] = useState(false)
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

  const loginMutation = useLogin()

  async function onSubmit(formData: LoginFormData) {
    try {
      await loginMutation.mutateAsync(formData)
      navigate({ to: '/app' })
    } catch (error: unknown) {
      setError('root', {
        message: getApiErrorMessage(error, {
          defaultMessage: 'Erro ao fazer login. Tente novamente.',
          invalidCredentialsMessage: 'Email ou senha inválidos',
        }),
      })
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="relative w-full max-w-sm space-y-6 rounded-lg border bg-background p-6 shadow-sm">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
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
              type={showPassword ? 'text' : 'password'}
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

          <div className="flex items-center gap-2">
            <input
              id="toggle-login-password"
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            <Label htmlFor="toggle-login-password">Mostrar senha</Label>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || loginMutation.isPending}
          >
            {isSubmitting || loginMutation.isPending ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
