import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getToken, useRegister } from '@/features/auth'
import { useUserTimezones } from '@/features/profile'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  DEFAULT_TIMEZONE,
  getBrowserTimezone,
  getIanaTimezones,
  getTimezoneDisplayLabel,
  normalizeSearch,
} from '@/lib/timezones'
import { registerSchema, type RegisterFormData } from '@/schemas/auth.schema'

export const Route = createFileRoute('/app/register')({
  component: RegisterUser,
})

function RegisterUser() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const [timezoneSearch, setTimezoneSearch] = useState('')
  const browserTimezone = useMemo(() => getBrowserTimezone(), [])
  const localTimezoneOptions = useMemo(() => getIanaTimezones(), [])
  const userTimezonesQuery = useUserTimezones({ enabled: Boolean(getToken()) })
  const timezoneOptions = useMemo(() => {
    const apiOptions = userTimezonesQuery.data ?? []
    return apiOptions.length > 0 ? apiOptions : localTimezoneOptions
  }, [localTimezoneOptions, userTimezonesQuery.data])
  const normalizedTimezoneSearch = normalizeSearch(timezoneSearch)
  const filteredTimezoneOptions = useMemo(() => {
    if (!normalizedTimezoneSearch) {
      return timezoneOptions
    }
    return timezoneOptions.filter((timezone) =>
      normalizeSearch(timezone).includes(normalizedTimezoneSearch),
    )
  }, [normalizedTimezoneSearch, timezoneOptions])

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      timezone: DEFAULT_TIMEZONE,
      password: '',
      confirmPassword: '',
    },
  })
  const registerTimezoneValue = watch('timezone')
  const timezoneOptionsForSelect = useMemo(() => {
    const current = registerTimezoneValue || DEFAULT_TIMEZONE
    const merged = filteredTimezoneOptions.includes(current)
      ? filteredTimezoneOptions
      : [current, ...filteredTimezoneOptions]
    return Array.from(new Set(merged))
  }, [filteredTimezoneOptions, registerTimezoneValue])

  const registerMutation = useRegister()

  async function onSubmit(formData: RegisterFormData) {
    setSuccessMessage(null)
    try {
      await registerMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        timezone: formData.timezone,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      })
      setSuccessMessage('Usuário criado com sucesso.')
      reset({
        name: '',
        email: '',
        timezone: DEFAULT_TIMEZONE,
        password: '',
        confirmPassword: '',
      })
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
            <Label htmlFor="register-timezone-search">Timezone</Label>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Detectado no dispositivo: {browserTimezone}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setValue('timezone', browserTimezone, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
                disabled={isSubmitting || registerMutation.isPending}
              >
                Usar autodetectado
              </Button>
            </div>
            <Input
              id="register-timezone-search"
              placeholder="Buscar timezone (ex.: Australia, Sao_Paulo, UTC)"
              value={timezoneSearch}
              onChange={(event) => setTimezoneSearch(event.target.value)}
              disabled={isSubmitting || registerMutation.isPending}
            />
            <Select
              value={registerTimezoneValue}
              onValueChange={(value) =>
                setValue('timezone', value, {
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
              disabled={isSubmitting || registerMutation.isPending}
            >
              <SelectTrigger id="register-timezone">
                <SelectValue placeholder="Selecione o timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptionsForSelect.map((timezone) => (
                  <SelectItem key={timezone} value={timezone}>
                    {getTimezoneDisplayLabel(timezone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.timezone && (
              <p className="text-sm text-destructive">{errors.timezone.message}</p>
            )}
            {filteredTimezoneOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum timezone encontrado para o filtro informado.
              </p>
            ) : null}
            {userTimezonesQuery.isError ? (
              <p className="text-xs text-muted-foreground">
                Catálogo local em uso. Não foi possível carregar a lista
                completa do servidor.
              </p>
            ) : null}
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
