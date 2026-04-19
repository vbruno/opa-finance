import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AuthPageShell,
  isAuthenticated,
  isAuthFormPending,
  submitWithApiRootError,
  useForgotPassword,
} from '@/features/auth'
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
  const isPending = isAuthFormPending(
    isSubmitting,
    forgotPasswordMutation.isPending,
  )

  async function onSubmit(formData: ForgotPasswordFormData) {
    await submitWithApiRootError({
      payload: formData,
      execute: forgotPasswordMutation.mutateAsync,
      setError,
      clearRootError: () => clearErrors('root'),
      defaultMessage: 'Erro ao solicitar recuperação de senha.',
    })
  }

  return (
    <AuthPageShell
      title="Recuperar senha"
      subtitle="Informe seu email para receber instruções."
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
            disabled={isPending}
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
          disabled={isPending}
        >
          {isPending
            ? 'Enviando...'
            : 'Enviar recuperação'}
        </Button>
      </form>
    </AuthPageShell>
  )
}
