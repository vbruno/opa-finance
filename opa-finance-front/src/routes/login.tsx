import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AuthPageShell,
  isAuthenticated,
  isAuthFormPending,
  submitWithApiRootError,
  useLogin,
} from '@/features/auth'
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
  const isPending = isAuthFormPending(isSubmitting, loginMutation.isPending)

  async function onSubmit(formData: LoginFormData) {
    await submitWithApiRootError({
      payload: formData,
      execute: loginMutation.mutateAsync,
      setError,
      defaultMessage: 'Erro ao fazer login. Tente novamente.',
      invalidCredentialsMessage: 'Email ou senha inválidos',
      onSuccess: async () => {
        navigate({ to: '/app' })
      },
    })
  }

  return (
    <AuthPageShell
      title="Opa Finance"
      subtitle="Entre com sua conta para continuar"
    >
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
            disabled={isPending}
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            disabled={isPending}
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
          disabled={isPending}
        >
          {isPending ? 'Entrando...' : 'Entrar'}
        </Button>

        <div className="text-center text-sm">
          <Link to="/forgot-password" className="text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      </form>
    </AuthPageShell>
  )
}
