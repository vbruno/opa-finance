import { describe, expect, it } from 'vitest'

import { resolveAuditAccountLabel } from '@/features/audit/mappers/audit-log.mapper'
import type { AuditLog } from '@/features/audit'

function makeLog(partial: Partial<AuditLog>): AuditLog {
  return {
    id: 'log-1',
    userId: 'user-1',
    entityType: 'transaction',
    entityId: 'trx-1',
    action: 'create',
    beforeData: null,
    afterData: null,
    metadata: null,
    createdAt: '2026-04-17T00:00:00.000Z',
    ...partial,
  }
}

describe('audit-log.mapper', () => {
  it('deve priorizar nome da conta em summary quando amigável', () => {
    const label = resolveAuditAccountLabel(
      makeLog({ summary: { accountName: 'CommBank ACC' } }),
      new Map(),
    )
    expect(label).toBe('CommBank ACC')
  })

  it('deve resolver accountId via mapa de contas quando necessário', () => {
    const accountId = '295bf2db-2d25-4367-a289-f2d98f03057c'
    const label = resolveAuditAccountLabel(
      makeLog({ afterData: { accountId } }),
      new Map([[accountId, 'Conta principal']]),
    )
    expect(label).toBe('Conta principal')
  })
})
