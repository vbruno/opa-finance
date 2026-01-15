import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRegister } from '@/features/auth'
import { getApiErrorMessage } from '@/lib/apiError'
import { registerSchema, type RegisterFormData } from '@/schemas/auth.schema'

export const Route = createFileRoute('/app/register')({
  component: RegisterUser,
})

function RegisterUser() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const registerMutation = useRegister()

  async function onSubmit(formData: RegisterFormData) {
    setSuccessMessage(null)
    try {
      await registerMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      })
      setSuccessMessage('Usuário criado com sucesso.')
      reset()
    } catch (error: unknown) {
      setError('root', {
        message: getApiErrorMessage(error, {
          defaultMessage: 'Erro ao criar usuário. Tente novamente.',
        }),
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Criar usuário</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre um novo usuário para acessar o sistema.
        </p>
      </div>

      <div className="max-w-xl rounded-lg border bg-background p-4 shadow-sm sm:p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root?.message && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}
          {successMessage && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Nome completo"
              disabled={isSubmitting || registerMutation.isPending}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              disabled={isSubmitting || registerMutation.isPending}
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
              type={showPasswords ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={isSubmitting || registerMutation.isPending}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type={showPasswords ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={isSubmitting || registerMutation.isPending}
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <label
            htmlFor="toggle-register-password"
            className="flex items-center gap-2 text-sm"
          >
            <input
              id="toggle-register-password"
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={showPasswords}
              onChange={(event) => setShowPasswords(event.target.checked)}
            />
            <span>Mostrar senhas</span>
          </label>

          <Button
            type="submit"
            className="h-11 w-full sm:h-10"
            disabled={isSubmitting || registerMutation.isPending}
          >
            {isSubmitting || registerMutation.isPending
              ? 'Criando...'
              : 'Criar usuário'}
          </Button>
        </form>
      </div>
    </div>
  )
}
