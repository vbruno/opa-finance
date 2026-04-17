import type { AuditAction, AuditEntityType } from '@/features/audit'

export const AUDIT_ENTITY_TYPES: AuditEntityType[] = [
  'transaction',
  'account',
  'category',
  'subcategory',
]

export const AUDIT_ACTIONS: AuditAction[] = ['create', 'update', 'delete']

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  transaction: 'Transações',
  account: 'Contas',
  category: 'Categorias',
  subcategory: 'Subcategorias',
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Criação',
  update: 'Edição',
  delete: 'Exclusão',
}
