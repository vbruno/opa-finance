import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'

import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isAuthenticated, useForgotPassword } from '@/features/auth'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '@/schemas/auth.schema'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: '/app' })
    }
  },
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const forgotPasswordMutation = useForgotPassword()
  const responseMessage = forgotPasswordMutation.data?.message
  const resetToken = forgotPasswordMutation.data?.resetToken

  async function onSubmit(formData: ForgotPasswordFormData) {
    clearErrors('root')
    try {
      await forgotPasswordMutation.mutateAsync(formData)
    } catch (error: unknown) {
      setError('root', {
        message: getApiErrorMessage(error, {
          defaultMessage: 'Erro ao solicitar recuperação de senha.',
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
          <h1 className="text-2xl font-bold sm:text-3xl">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground">
            Informe seu email para receber instruções.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root?.message && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}

          {responseMessage && (
            <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
              {responseMessage}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              disabled={isSubmitting || forgotPasswordMutation.isPending}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {resetToken && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
              <p className="mb-2 font-medium">Token de teste (ambiente não produção)</p>
              <p className="break-all font-mono">{resetToken}</p>
              <Link
                to="/reset-password"
                search={{ token: resetToken }}
                className="mt-3 inline-block text-sm text-primary hover:underline"
              >
                Abrir redefinição com token
              </Link>
            </div>
          )}

          <Button
            type="submit"
            className="h-11 w-full sm:h-10"
            disabled={isSubmitting || forgotPasswordMutation.isPending}
          >
            {isSubmitting || forgotPasswordMutation.isPending
              ? 'Enviando...'
              : 'Enviar recuperação'}
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
