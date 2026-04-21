import { Button } from '@/components/ui/button'
import { ShortcutTooltip } from '@/components/ui/shortcut-hint'

type AccountPrimaryConfirmModalProps = {
  isOpen: boolean
  accountName: string | null
  isSettingPrimary: boolean
  primaryError: string | null
  onClose: () => void
  onConfirm: () => void
}

export function AccountPrimaryConfirmModal({
  isOpen,
  accountName,
  isSettingPrimary,
  primaryError,
  onClose,
  onConfirm,
}: AccountPrimaryConfirmModalProps) {
  if (!isOpen || !accountName) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:max-h-none sm:overflow-visible sm:p-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Definir conta principal</h3>
          <p className="text-sm text-muted-foreground">
            Deseja definir a conta {accountName} como principal?
          </p>
        </div>

        {primaryError && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {primaryError}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <ShortcutTooltip label="Atalho: Esc">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={onClose}
              disabled={isSettingPrimary}
            >
              Cancelar
            </Button>
          </ShortcutTooltip>
          <Button className="w-full sm:w-auto" onClick={onConfirm} disabled={isSettingPrimary}>
            {isSettingPrimary ? 'Definindo...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
