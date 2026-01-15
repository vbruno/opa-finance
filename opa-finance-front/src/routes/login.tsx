import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isAuthenticated, useLogin } from '@/features/auth'
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
      <div className="relative w-full max-w-sm space-y-5 rounded-lg border bg-background p-4 shadow-sm sm:p-6">
        <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
          <ThemeToggle />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Opa Finance</h1>
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

          <label
            htmlFor="toggle-login-password"
            className="flex items-center gap-2 text-sm"
          >
            <input
              id="toggle-login-password"
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            <span>Mostrar senha</span>
          </label>

          <Button
            type="submit"
            className="h-11 w-full sm:h-10"
            disabled={isSubmitting || loginMutation.isPending}
          >
            {isSubmitting || loginMutation.isPending ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
