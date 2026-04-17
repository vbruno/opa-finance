import type { UseFormReturn } from 'react-hook-form'

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
import { getTimezoneDisplayLabel } from '@/lib/timezones'
import type { UpdateProfileFormData } from '@/schemas/user.schema'

type ProfilePersonalSectionProps = {
  isUserReady: boolean
  userEmail: string
  createdAtLabel: string
  browserTimezone: string
  timezoneSearch: string
  timezoneOptionsForSelect: string[]
  filteredTimezoneOptionsLength: number
  isTimezoneCatalogError: boolean
  profileMessage: string | null
  isUpdatingProfile: boolean
  profileForm: UseFormReturn<UpdateProfileFormData>
  onTimezoneSearchChange: (value: string) => void
  onUseAutodetectedTimezone: () => void
  onSubmit: () => void
}

export function ProfilePersonalSection({
  isUserReady,
  userEmail,
  createdAtLabel,
  browserTimezone,
  timezoneSearch,
  timezoneOptionsForSelect,
  filteredTimezoneOptionsLength,
  isTimezoneCatalogError,
  profileMessage,
  isUpdatingProfile,
  profileForm,
  onTimezoneSearchChange,
  onUseAutodetectedTimezone,
  onSubmit,
}: ProfilePersonalSectionProps) {
  const profileTimezoneValue = profileForm.watch('timezone')

  return (
    <section className="rounded-lg border bg-background p-4 shadow-sm sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Dados pessoais</h2>
        <p className="text-sm text-muted-foreground">
          Email e data de cadastro são somente leitura.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Nome</Label>
          <Input
            id="profile-name"
            placeholder="Seu nome"
            disabled={!isUserReady || isUpdatingProfile}
            aria-invalid={!!profileForm.formState.errors.name}
            {...profileForm.register('name')}
          />
          {profileForm.formState.errors.name && (
            <p className="text-sm text-destructive">
              {profileForm.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={userEmail} disabled />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="profile-timezone-search">Timezone</Label>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Detectado no dispositivo: {browserTimezone}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUseAutodetectedTimezone}
            disabled={!isUserReady || isUpdatingProfile}
          >
            Usar autodetectado
          </Button>
        </div>
        <Input
          id="profile-timezone-search"
          placeholder="Buscar timezone (ex.: Australia, Sao_Paulo, UTC)"
          value={timezoneSearch}
          onChange={(event) => onTimezoneSearchChange(event.target.value)}
          disabled={!isUserReady || isUpdatingProfile}
        />
        <Select
          value={profileTimezoneValue}
          onValueChange={(value) =>
            profileForm.setValue('timezone', value, {
              shouldDirty: true,
              shouldTouch: true,
            })
          }
          disabled={!isUserReady || isUpdatingProfile}
        >
          <SelectTrigger id="profile-timezone">
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
        {profileForm.formState.errors.timezone && (
          <p className="text-sm text-destructive">
            {profileForm.formState.errors.timezone.message}
          </p>
        )}
        {filteredTimezoneOptionsLength === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum timezone encontrado para o filtro informado.
          </p>
        ) : null}
        {isTimezoneCatalogError ? (
          <p className="text-xs text-muted-foreground">
            Catálogo local em uso. Não foi possível carregar a lista completa do
            servidor.
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="profile-created">Cadastro</Label>
        <Input id="profile-created" value={createdAtLabel} disabled />
      </div>

      {profileForm.formState.errors.root?.message && (
        <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {profileForm.formState.errors.root.message}
        </div>
      )}
      {profileMessage && (
        <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          {profileMessage}
        </div>
      )}

      <div className="mt-6">
        <Button
          onClick={onSubmit}
          className="h-11 w-full sm:h-10 sm:w-auto"
          disabled={!isUserReady || isUpdatingProfile || profileForm.formState.isSubmitting}
        >
          {isUpdatingProfile ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </section>
  )
}
