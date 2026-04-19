import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  isAuthenticated,
  setApiRootFormError,
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

  useEffect(() => {
    if (search.token) {
      setValue('token', search.token)
    }
  }, [search.token, setValue])

  async function onSubmit(formData: ResetPasswordFormData) {
    clearErrors('root')
    try {
      await resetPasswordMutation.mutateAsync(formData)
    } catch (error: unknown) {
      setApiRootFormError({
        error,
        setError,
        defaultMessage: 'Erro ao redefinir senha.',
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
          <h1 className="text-2xl font-bold sm:text-3xl">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">
            Informe o token e a nova senha.
          </p>
        </div>

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
              disabled={isSubmitting || resetPasswordMutation.isPending}
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
              type="password"
              placeholder="Nova senha"
              disabled={isSubmitting || resetPasswordMutation.isPending}
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
              type="password"
              placeholder="Confirme a nova senha"
              disabled={isSubmitting || resetPasswordMutation.isPending}
              aria-invalid={!!errors.confirmNewPassword}
              {...register('confirmNewPassword')}
            />
            {errors.confirmNewPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmNewPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="h-11 w-full sm:h-10"
            disabled={isSubmitting || resetPasswordMutation.isPending}
          >
            {isSubmitting || resetPasswordMutation.isPending
              ? 'Salvando...'
              : 'Redefinir senha'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Voltar para login
          </Link>
        </div>
      </div>
    </div>
  )
}
