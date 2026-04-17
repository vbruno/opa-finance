import type { AuditAction, AuditEntityType } from '@/features/audit'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
} from '@/features/audit/model/audit.constants'

export function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export function normalizeAuditString(value: string | null | undefined) {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function readRecordString(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key]
  return typeof value === 'string' ? value : null
}

export function normalizePreviewData(data: Record<string, unknown> | null) {
  if (!data) {
    return [] as Array<{ key: string; value: string }>
  }

  return Object.entries(data).map(([key, value]) => ({
    key,
    value:
      value === null || value === undefined
        ? '-'
        : typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value),
  }))
}

export function actionLabel(action: AuditAction) {
  return AUDIT_ACTION_LABELS[action]
}

export function screenLabel(entity: AuditEntityType) {
  return AUDIT_ENTITY_LABELS[entity]
}
