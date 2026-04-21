import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AuthPageShell,
  isAuthenticated,
  isAuthFormPending,
  submitWithApiRootError,
  useResetPassword,
} from '@/features/auth'
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '@/schemas/auth.schema'

const resetPasswordSearchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/reset-password')({
  validateSearch: resetPasswordSearchSchema,
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: '/app' })
    }
  },
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const search = Route.useSearch()
  const [showPassword, setShowPassword] = useState(false)
  const resetPasswordMutation = useResetPassword()
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: search.token ?? '',
      newPassword: '',
      confirmNewPassword: '',
    },
  })
  const isPending = isAuthFormPending(isSubmitting, resetPasswordMutation.isPending)

  useEffect(() => {
    if (search.token) {
      setValue('token', search.token)
    }
  }, [search.token, setValue])

  async function onSubmit(formData: ResetPasswordFormData) {
    await submitWithApiRootError({
      payload: formData,
      execute: resetPasswordMutation.mutateAsync,
      setError,
      clearRootError: () => clearErrors('root'),
      defaultMessage: 'Erro ao redefinir senha.',
    })
  }

  return (
    <AuthPageShell
      title="Redefinir senha"
      subtitle="Informe o token e a nova senha."
      footer={
        <Link to="/login" className="text-primary hover:underline">
          Voltar para login
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errors.root?.message && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errors.root.message}
          </div>
        )}

        {resetPasswordMutation.isSuccess && (
          <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            Senha redefinida com sucesso.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="token">Token</Label>
          <Input
            id="token"
            type="text"
            placeholder="Cole o token de recuperação"
            disabled={isPending}
            aria-invalid={!!errors.token}
            {...register('token')}
          />
          {errors.token && (
            <p className="text-sm text-destructive">{errors.token.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">Nova senha</Label>
          <Input
            id="newPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="Nova senha"
            disabled={isPending}
            aria-invalid={!!errors.newPassword}
            {...register('newPassword')}
          />
          {errors.newPassword && (
            <p className="text-sm text-destructive">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmNewPassword">Confirmar nova senha</Label>
          <Input
            id="confirmNewPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirme a nova senha"
            disabled={isPending}
            aria-invalid={!!errors.confirmNewPassword}
            {...register('confirmNewPassword')}
          />
          {errors.confirmNewPassword && (
            <p className="text-sm text-destructive">
              {errors.confirmNewPassword.message}
            </p>
          )}
        </div>

        <label
          htmlFor="toggle-reset-password-visibility"
          className="flex items-center gap-2 text-sm"
        >
          <input
            id="toggle-reset-password-visibility"
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
          {isPending
            ? 'Salvando...'
            : 'Redefinir senha'}
        </Button>
      </form>
    </AuthPageShell>
  )
}
