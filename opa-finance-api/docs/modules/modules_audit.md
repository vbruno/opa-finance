# Modulo: Audit

## Responsabilidades

- Registrar eventos de auditoria das operacoes de negocio
- Manter trilha historica por usuario autenticado
- Persistir snapshots antes/depois em alteracoes
- Apoiar rastreabilidade de mudancas e diagnostico operacional

## Regras

- Escopo inicial auditado:
  - transactions
  - accounts
  - categories
  - subcategories
- Acoes suportadas:
  - create
  - update
  - delete
- Cada log deve conter:
  - user_id
  - entity_type
  - entity_id
  - action
  - created_at
- `before_data` e `after_data` sao opcionais conforme a acao:
  - create: normalmente apenas `after_data`
  - update: `before_data` + `after_data`
  - delete: normalmente apenas `before_data`
- Gravacao deve ocorrer no mesmo fluxo transacional quando aplicavel
- Nao registrar dados sensiveis no payload de auditoria

## Campos da tabela audit_logs

- id (uuid)
- user_id (uuid)
- entity_type (enum: transaction, account, category, subcategory)
- entity_id (uuid)
- action (enum: create, update, delete)
- before_data (jsonb, opcional)
- after_data (jsonb, opcional)
- metadata (jsonb, opcional)
- created_at (timestamp)

## Indices

- audit_logs_user_created_at_idx (user_id, created_at)
- audit_logs_entity_created_at_idx (entity_type, created_at)
- audit_logs_action_created_at_idx (action, created_at)

## Endpoints

- Nesta fase, o modulo esta com foco em gravacao interna via service.
- Endpoint de leitura paginada (`GET /audit-logs`) esta planejado para a proxima etapa.

