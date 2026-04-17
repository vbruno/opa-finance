import { normalizePreviewData } from '@/features/audit/model/audit.helpers'

type AuditPreviewBlockProps = {
  title: string
  data: Record<string, unknown> | null
}

export function AuditPreviewBlock({ title, data }: AuditPreviewBlockProps) {
  const fields = normalizePreviewData(data)

  return (
    <details className="rounded-md border p-1.5">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        {title}
      </summary>
      <div className="mt-1.5 max-h-36 space-y-1 overflow-auto text-[11px]">
        {fields.length === 0 ? (
          <p className="text-muted-foreground">Sem dados.</p>
        ) : (
          fields.map((field) => (
            <div key={field.key} className="grid grid-cols-[110px_1fr] gap-2">
              <span className="text-muted-foreground">{field.key}</span>
              <span className="break-words font-medium">{field.value}</span>
            </div>
          ))
        )}
      </div>
    </details>
  )
}
