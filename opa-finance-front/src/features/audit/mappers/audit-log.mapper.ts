import type { AuditLog } from '@/features/audit'
import {
  looksLikeUuid,
  normalizeAuditString,
  readRecordString,
} from '@/features/audit/model/audit.helpers'

export function resolveAuditAccountLabel(
  log: AuditLog,
  accountNameById: Map<string, string>,
) {
  const summaryAccount = normalizeAuditString(log.summary?.accountName)
  if (summaryAccount && !looksLikeUuid(summaryAccount)) {
    return summaryAccount
  }

  const explicitName =
    normalizeAuditString(readRecordString(log.afterDataFriendly, 'accountName')) ||
    normalizeAuditString(readRecordString(log.beforeDataFriendly, 'accountName')) ||
    normalizeAuditString(readRecordString(log.metadataFriendly, 'accountName')) ||
    normalizeAuditString(readRecordString(log.afterData, 'accountName')) ||
    normalizeAuditString(readRecordString(log.beforeData, 'accountName')) ||
    normalizeAuditString(readRecordString(log.metadata, 'accountName'))
  if (explicitName) {
    return explicitName
  }

  const accountIdCandidate =
    (summaryAccount && looksLikeUuid(summaryAccount) ? summaryAccount : null) ||
    normalizeAuditString(readRecordString(log.afterDataFriendly, 'accountId')) ||
    normalizeAuditString(readRecordString(log.beforeDataFriendly, 'accountId')) ||
    normalizeAuditString(readRecordString(log.metadataFriendly, 'accountId')) ||
    normalizeAuditString(readRecordString(log.afterData, 'accountId')) ||
    normalizeAuditString(readRecordString(log.beforeData, 'accountId')) ||
    normalizeAuditString(readRecordString(log.metadata, 'accountId'))

  if (accountIdCandidate) {
    return accountNameById.get(accountIdCandidate) ?? accountIdCandidate
  }

  return '-'
}
