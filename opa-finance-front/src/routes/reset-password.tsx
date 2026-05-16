import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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
  useValidateResetToken,
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
  const tokenFromUrl = search.token
  const validateQuery = useValidateResetToken(tokenFromUrl)
  const [resetSucceeded, setResetSucceeded] = useState(false)

  const tokenIsInvalid =
    Boolean(tokenFromUrl) &&
    validateQuery.isSuccess &&
    !validateQuery.data.valid

  const validationFailed = Boolean(tokenFromUrl) && validateQuery.isError

  if (resetSucceeded) {
    return <ResetPasswordSuccessCard />
  }

  if (tokenFromUrl && validateQuery.isLoading) {
    return (
      <AuthPageShell
        title="Redefinir senha"
        subtitle="Verificando link..."
        footer={
          <Link to="/login" className="text-primary hover:underline">
            Voltar para login
          </Link>
        }
      >
        <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
          Validando seu link de redefinição...
        </div>
      </AuthPageShell>
    )
  }

  if (validationFailed) {
    return (
      <AuthPageShell
        title="Não foi possível verificar"
        subtitle="Houve um problema ao validar seu link."
        footer={
          <Link to="/login" className="text-primary hover:underline">
            Voltar para login
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Não conseguimos verificar seu link agora. Pode ser uma instabilidade
            temporária — tente novamente em instantes.
          </div>
          <Button
            type="button"
            className="h-11 w-full sm:h-10"
            disabled={validateQuery.isFetching}
            onClick={() => {
              void validateQuery.refetch()
            }}
          >
            {validateQuery.isFetching ? 'Verificando...' : 'Tentar novamente'}
          </Button>
        </div>
      </AuthPageShell>
    )
  }

  if (tokenIsInvalid) {
    return (
      <AuthPageShell
        title="Link inválido"
        subtitle="Este link de redefinição não pode mais ser usado."
        footer={
          <Link to="/login" className="text-primary hover:underline">
            Voltar para login
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            O link expirou ou já foi utilizado. Solicite um novo email de
            redefinição para continuar.
          </div>
          <Link to="/forgot-password" className="block">
            <Button type="button" className="h-11 w-full sm:h-10">
              Solicitar novo link
            </Button>
          </Link>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <ResetPasswordForm
      initialToken={tokenFromUrl ?? ''}
      onSuccess={() => setResetSucceeded(true)}
    />
  )
}

const SUCCESS_REDIRECT_SECONDS = 10

function ResetPasswordSuccessCard() {
  const navigate = useNavigate()
  const [remaining, setRemaining] = useState(SUCCESS_REDIRECT_SECONDS)

  useEffect(() => {
    if (remaining <= 0) {
      navigate({ to: '/login' })
      return
    }
    const timeout = setTimeout(() => {
      setRemaining((value) => value - 1)
    }, 1000)
    return () => clearTimeout(timeout)
  }, [remaining, navigate])

  return (
    <AuthPageShell
      title="Senha redefinida"
      subtitle="Tudo certo com a sua nova senha."
      footer={
        <Link to="/login" className="text-primary hover:underline">
          Voltar para login
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <p className="font-medium">Sua senha foi atualizada com sucesso.</p>
          <p className="mt-1">
            Enviamos um email de confirmação para a sua caixa de entrada. Agora
            é só entrar com a nova senha.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Redirecionando para o login em <span className="font-medium">{remaining}s</span>...
        </p>

        <Button
          type="button"
          className="h-11 w-full sm:h-10"
          onClick={() => navigate({ to: '/login' })}
        >
          Ir para o login agora
        </Button>
      </div>
    </AuthPageShell>
  )
}

function ResetPasswordForm({
  initialToken,
  onSuccess,
}: {
  initialToken: string
  onSuccess: () => void
}) {
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
      token: initialToken,
      newPassword: '',
      confirmNewPassword: '',
    },
  })
  const isPending = isAuthFormPending(isSubmitting, resetPasswordMutation.isPending)

  useEffect(() => {
    if (initialToken) {
      setValue('token', initialToken)
    }
  }, [initialToken, setValue])

  async function onSubmit(formData: ResetPasswordFormData) {
    await submitWithApiRootError({
      payload: formData,
      execute: resetPasswordMutation.mutateAsync,
      setError,
      clearRootError: () => clearErrors('root'),
      defaultMessage: 'Erro ao redefinir senha.',
      onSuccess,
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
