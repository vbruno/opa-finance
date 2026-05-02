# Recorrência - Runbook do Job Diário (S4-08)

## Escopo

Operação do job diário de materialização de recorrências no backend.

Arquivo de referência técnica:
- `opa-finance-api/src/modules/recurrences/recurrence-daily-job.ts`

O job diário percorre recorrências ativas do usuário no horário alvo por timezone, materializa em lotes e respeita o `postingMode` da regra:

- `automatic`: cria a transação ou transferência automaticamente
- `review_required`: cria `pending_review` e não lança a movimentação até confirmação manual

No MVP, `failed` é terminal. Não existe retry automático da ocorrência falha nem reabertura pelo fluxo padrão.

## Pré-requisitos

- API em execução com acesso ao PostgreSQL
- migrations aplicadas
- variáveis de ambiente configuradas

## Configuração (ENV)

- `RECURRENCES_JOB_ENABLED`
- `RECURRENCES_JOB_TARGET_TIME` (HH:MM)
- `RECURRENCES_JOB_POLL_INTERVAL_MS`
- `RECURRENCES_JOB_LOCK_TTL_MS`
- `RECURRENCES_JOB_TIMEOUT_MS`
- `RECURRENCES_JOB_RETRY_DELAYS_MS` (csv em ms)
- `RECURRENCES_JOB_BATCH_SIZE` (máx 500)
- `RECURRENCES_JOB_MAX_ATTEMPTS`
- `RECURRENCES_JOB_MAX_BATCHES_PER_USER_RUN`

## Fluxo operacional resumido

1. Scheduler faz polling no intervalo configurado.
2. Tenta adquirir lock distribuído (`JOB_KEY`).
3. Processa usuários devidos no horário alvo por timezone.
4. Executa materialização em lotes com retry/backoff.
5. Emite logs estruturados de sucesso/falha/lote.
6. Libera lock.

## Eventos de log importantes

- `recurrences.job.started`
- `recurrences.job.success`
- `recurrences.job.failed`
- `recurrences.job.timeout_waiting_background`
- `recurrences.job.completed_after_timeout`
- `recurrences.job.user.batch_result`
- `recurrences.job.user.batch_limit_reached`
- `recurrences.job.user.success`
- `recurrences.job.user.retry`
- `recurrences.job.lock_not_acquired`
- `recurrences.job.release_lock_failed`

Campos úteis nos logs de lote/usuário:

- `userId`
- `timezone`
- `attempt`
- `batchNumber`
- `batchSize`
- `createdOccurrences`
- `skippedOccurrences`
- `createdTransactions`
- `createdTransfers`
- `finalizedRecurrences`
- `failedRecurrences`

## Diagnóstico rápido

1. Confirmar se o job está habilitado (`RECURRENCES_JOB_ENABLED`).
2. Verificar `targetTime` e timezone dos usuários.
3. Verificar lock não liberado (timeouts/restart abrupto).
4. Verificar falhas por lote em `recurrences.job.user.batch_result`.
5. Consultar recorrências com falha terminal:

```sql
SELECT recurrence_id, COUNT(*)
FROM recurrence_occurrences
WHERE status = 'failed'
GROUP BY recurrence_id;
```
6. Consultar pendências em aberto por recorrência quando houver badge alto ou backlog:

```sql
SELECT recurrence_id, COUNT(*)
FROM recurrence_occurrences
WHERE status = 'pending_review'
GROUP BY recurrence_id;
```

7. Validar conectividade/latência com banco.

## Procedimento de falha

1. Coletar logs do período com `event` do job.
2. Identificar tipo:
- sem lock
- timeout
- erro de validação de regra
- erro de banco
3. Corrigir causa raiz.
4. Reprocessar manualmente recorrências pendentes.

## Reprocessamento manual

Opção por usuário autenticado (suporte/admin com token):

- `POST /recurrences/materialize`
- body opcional:
  - `untilDate`
  - `maxRecurrences`

Recomendação:
- executar em janela controlada
- usar lote conservador em incidentes
- monitorar `created/skipped/failed/finalized`

Observação:
- em `review_required`, `POST /recurrences/materialize` gera pendências, não transações
- em caso de `failed`, a recuperação do MVP é manual por SQL/reclassificação operacional; não há rota de retry

## Critérios de saída de incidente

- backlog pendente processado
- sem crescimento de falhas por lote
- lock operando normalmente
- validação amostral de ocorrências geradas sem duplicidade
- recorrências `failed` identificadas e tratadas manualmente quando aplicável

## Pós-incidente

- registrar causa, impacto e ação corretiva
- atualizar `docs-hidden/changes.md` quando houver correção de código
- se necessário, ajustar defaults de timeout/retry/batch
