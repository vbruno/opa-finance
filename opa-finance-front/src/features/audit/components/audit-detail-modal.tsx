import { Button } from '@/components/ui/button'
import type { AuditLog } from '@/features/audit'
import { AuditPreviewBlock } from '@/features/audit/components/audit-preview-block'
import { actionLabel, screenLabel } from '@/features/audit/model/audit.helpers'

type AuditDetailModalProps = {
  selectedLog: AuditLog
  selectedLogAccountName: string
  onClose: () => void
}

export function AuditDetailModal({
  selectedLog,
  selectedLogAccountName,
  onClose,
}: AuditDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="fixed inset-0"
        data-testid="audit-detail-backdrop"
        onClick={onClose}
      />
      <div className="relative max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-background p-3 shadow-lg sm:p-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Detalhes do log</h3>
          <p className="text-xs text-muted-foreground">
            Registro completo da alteração selecionada.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-md border px-3 py-2">
            <p className="text-xs text-muted-foreground">Tela</p>
            <p className="mt-0.5 font-medium">
              {selectedLog.summary?.screen ?? screenLabel(selectedLog.entityType)}
            </p>
          </div>
          <div className="rounded-md border px-3 py-2">
            <p className="text-xs text-muted-foreground">Tipo</p>
            <p className="mt-0.5 font-medium">
              {selectedLog.summary?.action ?? actionLabel(selectedLog.action)}
            </p>
          </div>
          <div className="rounded-md border px-3 py-2">
            <p className="text-xs text-muted-foreground">Conta</p>
            <p className="mt-0.5 font-medium">{selectedLogAccountName}</p>
          </div>
          <div className="rounded-md border px-3 py-2">
            <p className="text-xs text-muted-foreground">Data/Horário</p>
            <p className="mt-0.5 font-medium">
              {new Date(selectedLog.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          <AuditPreviewBlock
            title="Antes"
            data={selectedLog.beforeDataFriendly ?? selectedLog.beforeData}
          />
          <AuditPreviewBlock
            title="Depois"
            data={selectedLog.afterDataFriendly ?? selectedLog.afterData}
          />
          <AuditPreviewBlock
            title="Metadata"
            data={selectedLog.metadataFriendly ?? selectedLog.metadata}
          />
        </div>

        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
