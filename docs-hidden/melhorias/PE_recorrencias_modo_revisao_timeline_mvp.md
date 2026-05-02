# Plano de Execução - Recorrências com modo de revisão e timeline

## Status da melhoria [0]

Legenda:

- `0` em planejamento
- `1` pronto para execução
- `2` em desenvolvimento
- `3` em teste / observação
- `4` pronto para deploy
- `5` concluído

## Objetivo

Evoluir recorrências para suportar dois modos de lançamento: automático e com revisão antes de lançar.
Também criar uma visão detalhada da recorrência com linha do tempo de ocorrências, permitindo acompanhar parcelas lançadas, pendentes, ignoradas e previstas.

Exemplos de uso:

- compra parcelada de um computador, onde cada parcela aparece na recorrência com status próprio.
- aluguel, mensalidade ou serviço recorrente onde o usuário quer ser lembrado de pagar e confirmar com data/valor reais. O MVP entrega "lembrete passivo" — sem notificação ativa, o usuário vê pendências quando abre o app (`RCREV-DEF-35`).

## Escopo

Incluído:

- Novo modo técnico de lançamento da recorrência: `automatic` e `review_required`.
- Geração de ocorrências pendentes para revisão quando a recorrência exigir confirmação manual.
- Confirmação de pendência para criar transação/transferência.
- Ignorar pendência consumindo ocorrência em `by_occurrences`.
- Modal de detalhe da recorrência no frontend.
- Tabela de ocorrências/parcelas no detalhe da recorrência.
- Endpoint de timeline/detalhe misturando ocorrências persistidas e futuras calculadas.
- Ajuste de forecast para considerar ocorrências pendentes/ignoradas de forma explícita.
- Auditoria de ações críticas: criar pendência, confirmar, ignorar e falhar.

Fora deste passo:

- Cobrança automática externa, integração bancária ou importação de fatura.
- Reprocessamento massivo de recorrências antigas sem migração conservadora.
- Fluxo completo de edição em massa das pendências já geradas, salvo confirmação pontual no MVP.
- Alteração visual ampla da tela de transações.
- Nova dependência externa.
- Cleanup automático de pendências antigas (`pending_review` sem ação por X dias) — pendências persistem indefinidamente; limpeza fica para v2 com base em telemetria.
- Reprocessamento controlado de `failed` (rota de retry, contador `failedAttempts` e cap) — `failed` é terminal no MVP (`RCREV-CNF-12`); evolução planejada para v2.
- Endpoint global `GET /recurrences/occurrences/pending` e tela "Inbox de pendências" — visibilidade no MVP é via badge na listagem (`RCREV-DEF-27`).
- Notificação ativa para pendências (push, email, SMS, banner global, alerta antecipado por X dias) — MVP entrega lembrete passivo apenas (`RCREV-DEF-35`); planejar para v2.
- Campo `notifyDaysBefore` na recorrência para gerar pendência com antecedência — fora do MVP (`RCREV-DEF-35`).
- Distinção visual de urgência entre pendências (vencendo hoje vs vencida há X dias) — fora do MVP (`RCREV-DEF-35`).

## Contexto atual observado

- Backend concentra a regra de calendário em `opa-finance-api/src/core/utils/recurrence-schedule.utils.ts`.
- Backend possui `recurrences` como regra da série e `recurrence_occurrences` como histórico/idempotência.
- Hoje a ocorrência é essencialmente materializada ao criar transação/transferência.
- Backend já aceita `recurrence` aninhado em `POST /transactions` e `POST /transfers`, retornando `recurrenceId`.
- Frontend hoje cria transação/transferência e depois cria recorrência em chamada separada, o que deve ser revisto para evitar inconsistência e duplicidade.
- A configuração de recorrência aparece em três pontos do frontend: `RecurrenceFormModal` em `src/features/recurrences/components/recurrence-form-modal.tsx` e estado interno via `useTransactionRecurrenceDraft` nos modais de criação de transação e de transferência. Não há duplicidade do formulário em si, mas há lógica espalhada (validação, payload de criação) que deve convergir.
- O backend já tem `recurrence_occurrence_status` como enum Postgres com `materialized` e `failed`. Expandir o enum exige `ALTER TYPE ... ADD VALUE` em migration própria (não pode rodar dentro de transação que use o novo valor).
- A vinculação `transação ↔ ocorrência` é feita via `recurrence_occurrences.transactionId` (não via `transactions.recurrenceId`). A função `resolveSubmitOccurrence()` em `recurrence-schedule.utils.ts` já trata o caso em que a data inicial coincide com uma ocorrência válida, criando o registro em `recurrence_occurrences` com a `transactionId` resultante.
- Forecast atual (`recurrence-forecast.service.ts`) considera apenas `materialized` e `failed` ao calcular consumido vs projetado — qualquer ajuste de filtro deve ser tratado como alteração da regra existente, não como nova lógica.
- Auditoria atual (`audit.service.ts`) cobre `recurrence` apenas com `AuditAction = create | update | delete`.

## Decisões já alinhadas

- Haverá dois modos de recorrência:
  - `automatic`: lança automaticamente quando vencer.
  - `review_required`: gera pendência para revisão antes de lançar.
- Pendência ignorada deve consumir uma ocorrência do limite `by_occurrences`.
- Para compra parcelada, a modelagem recomendada é:
  - `endType = by_occurrences`
  - `endOccurrences = quantidade de parcelas`
  - `amount = valor da parcela`
- O modal de detalhe deve mostrar uma tabela de ocorrências/parcelas.
- A timeline deve incluir ocorrências persistidas e ocorrências futuras calculadas.

## Pronto para execução

- [ ] escopo MVP fechado
- [ ] decisões críticas fechadas
- [ ] conflitos previsíveis mapeados
- [ ] arquitetura e limites de módulo definidos
- [ ] estratégia de testes definida
- [ ] sprints com tasks rastreáveis prontas

## Definições pendentes para implementação

- Nenhuma definição pendente no momento.

## Conflitos previstos e resolução (para avaliação)

- [x] `RCREV-CNF-01` Duplicidade entre lançamento inicial e recorrência:
  - Cenário:
    - frontend cria transação/transferência e depois cria recorrência em chamada separada.
  - Risco:
    - a ocorrência da data inicial pode não ficar registrada como consumida e ser gerada novamente.
  - Resolução definida:
    - alinhar frontend para usar `recurrence` aninhado em `POST /transactions` e `POST /transfers` quando a recorrência nascer a partir de um lançamento.

- [x] `RCREV-CNF-02` Contagem de `by_occurrences`:
  - Cenário:
    - pendências ignoradas ou pendentes podem ou não consumir limite.
  - Risco:
    - se pendência ignorada não consumir, o sistema pode gerar pendências infinitas.
  - Resolução definida:
    - contar `pending_review`, `materialized` e `skipped` como ocorrências consumidas.

- [x] `RCREV-CNF-03` Regra editada após pendência gerada:
  - Cenário:
    - usuário altera valor/conta/categoria da regra enquanto existem pendências.
  - Risco:
    - pendência antiga muda implicitamente, quebrando previsibilidade.
  - Resolução definida:
    - salvar snapshot da ocorrência pendente em `reviewPayload`/`metadata` e confirmar a partir desse snapshot.

- [x] `RCREV-CNF-04` Transferência recorrente com revisão:
  - Cenário:
    - confirmação precisa criar duas transações atomizadas.
  - Risco:
    - criar apenas uma perna da transferência em caso de falha parcial.
  - Resolução definida:
    - confirmar dentro de transação de banco, criando as duas pernas ou nenhuma.

- [x] `RCREV-CNF-05` Timeline longa:
  - Cenário:
    - recorrência sem fim pode gerar projeção infinita.
  - Risco:
    - resposta pesada ou UI lenta.
  - Resolução definida:
    - endpoint de timeline nunca deve retornar projeção ilimitada.
    - `limit` default: 24 ocorrências.
    - `limit` máximo: 120 ocorrências.
    - `untilDate` opcional para limitar horizonte.
    - em `endType = never`, aplicar `limit` sempre, mesmo quando `untilDate` for enviado.
    - em `endType = by_occurrences`, permitir mostrar todas as ocorrências se o total ficar dentro do limite máximo.
    - UI deve indicar quando estiver exibindo janela parcial, por exemplo: `Exibindo próximas 24 ocorrências`.

- [x] `RCREV-CNF-06` Concorrência no confirm de pendência:
  - Cenário:
    - duplo clique ou múltiplas abas tentam confirmar a mesma pendência.
  - Risco:
    - duas transações criadas para a mesma ocorrência; estado inconsistente.
  - Resolução definida:
    - exigir `expectedStatus = 'pending_review'` implícito no `UPDATE ... WHERE id = ? AND status = 'pending_review' RETURNING *`; se 0 linhas, retornar 409.
    - mesma proteção para skip.

- [x] `RCREV-CNF-07` Avanço de `nextOccurrenceDate` quando gerar `pending_review`:
  - Cenário:
    - hoje a materialização atualiza `nextOccurrenceDate` e `lastMaterializedDate` ao criar transação.
    - em `review_required`, a ocorrência fica pendente — não é materializada.
  - Risco:
    - se `nextOccurrenceDate` não avançar, o job re-tenta gerar a mesma pendência; se avançar como hoje, mistura semântica de "agendado" com "lançado".
  - Resolução definida:
    - manter `nextOccurrenceDate` como ponteiro de "próxima a ser processada pelo job" e avançá-lo após a geração da pendência.
    - manter `lastMaterializedDate` apenas para ocorrências `materialized` (não atualizar ao criar pending).
    - documentar a separação no service de materialização.

- [x] `RCREV-CNF-08` Migração de enum Postgres:
  - Cenário:
    - expansão do enum `recurrence_occurrence_status` para incluir `pending_review` e `skipped`.
  - Risco:
    - `ALTER TYPE ... ADD VALUE` não roda dentro da mesma transação que usa o valor; falha silenciosa em ambientes que envolvem migration + seed no mesmo step.
  - Resolução definida:
    - migration dedicada apenas para `ADD VALUE` (sem usar o novo valor).
    - migration seguinte para colunas/defaults/uso.
    - validar em ambiente de staging antes de prod.

- [x] `RCREV-CNF-09` Endpoint `POST /recurrences/materialize` (admin/job) com `review_required`:
  - Cenário:
    - endpoint atual é usado pelo job diário e por ações administrativas para forçar materialização.
  - Risco:
    - chamar o endpoint em recorrência `review_required` pode bypass a revisão e criar transação direta.
  - Resolução definida:
    - o serviço deve respeitar `postingMode`: em `review_required`, gerar pendência ao invés de transação.
    - o nome `materialize` passa a ser ambíguo — manter, mas documentar que em `review_required` materializa como `pending_review`.

- [x] `RCREV-CNF-10` Contagem de `by_occurrences` no `recurrence-materialize.service.ts` ignora novos status:
  - Cenário:
    - validado no código: `recurrence-materialize.service.ts:231` filtra apenas `eq(status, "materialized")` ao calcular o consumo de `endOccurrences`.
    - `RCREV-CNF-02` define que `pending_review`, `materialized` e `skipped` devem consumir.
  - Risco:
    - sem ajuste, o job continua gerando pendências além do `endOccurrences` em recorrências `review_required` (gera infinitamente até o usuário confirmar/skipar).
  - Resolução definida:
    - na implementação de `RCREV-S2-03`, alterar a query de contagem para `inArray(status, ['materialized', 'pending_review', 'skipped'])`.
    - aplicar a mesma mudança em qualquer outra query que tenha lógica de "consumo de série" (ex.: validação ao editar regra com `endOccurrences` reduzido).
    - cobrir com teste explícito (`RCREV-S4-16`).

- [x] `RCREV-CNF-11` Forecast service não inclui `pending_review`/`skipped` na deduplicação e contagem:
  - Cenário:
    - validado no código: `recurrence-forecast.service.ts:132` (`materializedCountByRecurrence`) e `:150` (`materializedDateSet`) filtram apenas `eq(status, "materialized")`.
    - `RCREV-DEF-07` define excluir `materialized`, `pending_review` e `skipped` da projeção.
  - Risco:
    - sem ajuste:
      - `materializedDateSet` não contém datas de pendências persistidas — projeção futura duplica essas datas.
      - `materializedCountByRecurrence` não conta pendências/skipped — `remainingOccurrences` fica inflado e a projeção gera mais ocorrências do que a regra permite.
  - Resolução definida:
    - na implementação de `RCREV-S2-07`, expandir os dois filtros para `inArray(status, ['materialized', 'pending_review', 'skipped'])`.
    - renomear as variáveis para refletir a semântica nova (ex.: `consumedCountByRecurrence`, `consumedDateSet`) — torna óbvio que não é mais "só materializadas".
    - cobrir com testes explícitos: criar 3 pendências, conferir que forecast retorna 3 itens (não 6).

- [x] `RCREV-CNF-12` `failed` é estado terminal devido ao índice idempotente:
  - Cenário:
    - índice `unique (recurrenceId, occurrenceDate, originType)` impede re-INSERT na mesma data.
    - job usa `onConflictDoNothing`, então em data já marcada como `failed` o re-processamento é silenciosamente pulado.
  - Risco:
    - sem mecanismo de retry, `failed` se torna terminal — diverge da intenção de `RCREV-DEF-06` ("permitir reprocessamento controlado") embora `RCREV-DEF-17` tenha colocado o retry para fora do MVP.
  - Resolução definida (aceite consciente para o MVP):
    - documentar explicitamente no service e no doc operacional que `failed` é terminal no MVP.
    - ocorrência em `failed` continua não consumindo `by_occurrences` (`RCREV-DEF-06`) — operação manual via SQL é a única recuperação prevista.
    - em v2, considerar `onConflictDoUpdate` quando `status = 'failed'` para reabrir como `pending_review`, ou rota dedicada de retry.
    - métrica/alerta de `failed` count por recorrência ajuda a detectar séries presas (recomendação operacional, não bloqueante).

## Definições fechadas

- [x] `RCREV-DEF-01` Política de forecast para pendências:
  - Definição:
    - contar pendências em `projected` e expor metadados separados para manter forecast útil sem misturar com `real`.
  - Avaliação:
    - **Recomendação:** manter como está. Pendência é "compromisso esperado mas não confirmado", então faz sentido entrar como projetado, não real.
    - **Alternativas avaliadas:**
      - (a) categoria nova `pending` no forecast (separada de `real` e `projected`) — mais granular para a UI mas duplica o conceito de status que já está na ocorrência.
      - (b) ignorar pendência no forecast — esconde valor que o usuário sabe que vai vencer; piora o forecast.
    - **Trade-off:** o forecast pode subestimar o "real" em meses com muitas pendências; o usuário precisa entender que `projected` agora inclui pendências persistidas.
    - **Risco se mudar depois:** baixo — só requer reagrupar o resultado da query.

- [x] `RCREV-DEF-02` Ajuste permitido na confirmação:
  - Definição:
    - permitir ajustes pontuais na confirmação, sem alterar a regra-mãe.
  - Avaliação:
    - **Recomendação:** manter. Ajuste pontual é o cenário real (ex.: parcela do mês veio R$ 5 a mais por taxa, nova categoria pontual).
    - **Pontos a fechar:**
      - quais campos podem ser ajustados? Hoje o payload de `confirm` lista todos. Vale considerar bloquear `originType` e `recurrenceId` (não fazem sentido mudar).
      - mudança de `accountId` exige validação de ownership e pode invalidar a regra-mãe se for um caso comum.
    - **Alternativa avaliada:** não permitir ajuste — confirmar exatamente o que está no snapshot. Reduz complexidade mas obriga o usuário a editar a transação depois (UX pior).
    - **Trade-off:** snapshot perde fidelidade se os ajustes forem frequentes; mitigado por gravar o ajuste em `metadata` e pelo histórico de auditoria.

- [x] `RCREV-DEF-03` Reabertura de ocorrência ignorada:
  - Definição:
    - bloquear reabertura no MVP e exigir ajuste manual ou nova recorrência.
  - Avaliação:
    - **Recomendação:** manter no MVP. Reabertura adiciona estados intermediários (`reopened` ou `pending_review` vindo de `skipped`) que aumentam a superfície de teste sem ganho claro.
    - **Alternativa avaliada:** permitir reabertura via `POST /recurrences/occurrences/:id/reopen` que volta a `pending_review`. Útil quando o usuário ignorar por engano.
    - **Trade-off:** se for comum errar o skip, o atrito de "criar transação manual" pode irritar. Recomendo medir incidência via auditoria antes de planejar para v2.
    - **Atenção:** pendência ignorada já consome `by_occurrences` (`RCREV-DEF-11`). Reabrir depois quebraria a contagem se não for tratado.

- [x] `RCREV-DEF-04` Tratamento de pendências em edição `this_and_next`:
  - Definição:
    - manter pendências já geradas como snapshot histórico no MVP; mudanças afetam novas ocorrências ainda não geradas.
  - Avaliação:
    - **Recomendação:** manter, mas formalizar a UX de aviso. Quando o usuário editar com `this_and_next` e existir pendência aberta, mostrar mensagem clara: "X pendências existentes não serão alteradas".
    - **Alternativa avaliada:** propagar mudanças para pendências `pending_review` automaticamente. Quebra previsibilidade do snapshot e o princípio de RCREV-CNF-03.
    - **Risco se mudar depois:** alto — quebra contrato de auditoria e snapshot.
    - **Pendente correlacionado:** `RCREV-DEF-18` cobre o caso `single` em pending; já alinhado com este princípio.

- [x] `RCREV-DEF-05` Navegação para transação/transferência materializada:
  - Definição:
    - abrir detalhe da transação quando houver `transactionId` ou lista filtrada por `transferId` para transferências.
  - Avaliação:
    - **Recomendação:** manter, mas validar que existe rota de detalhe de transação no frontend hoje. Se não existir, é uma sub-task implícita não listada — adicionar ao Sprint C se for o caso.
    - **Alternativa avaliada:** abrir modal in-place no próprio modal de detalhe da recorrência. UX mais fluida mas exige mais componentes.
    - **Trade-off:** abrir nova rota fecha o modal de detalhe e perde contexto de navegação; se isso for ruim, considerar drawer lateral em v2.
    - **Pendente correlacionado:** se `transferId` não existir como filtro na lista de transações hoje, é necessário adicioná-lo no backend.

- [x] `RCREV-DEF-06` Semântica de `failed` em `by_occurrences`:
  - Definição:
    - `failed` não deve consumir ocorrência por padrão e deve permitir reprocessamento controlado, preservando auditoria.
  - Avaliação:
    - **Recomendação:** manter, mas notar que está atrelada a `RCREV-DEF-17` (reprocessamento de `failed`) que ainda está pendente. Se DEF-17 ficar fora do MVP, `failed` na prática é apenas observabilidade — sem caminho de recuperação fora de SQL manual.
    - **Implicação para `by_occurrences`:** se `failed` não consumir, série pode rodar "para sempre" tentando — mitigar com retry-cap (ex.: 5 tentativas → marca como `failed_terminal` que consome). Não está no plano hoje.
    - **Alternativa avaliada:** consumir ocorrência em `failed` para garantir progresso da série. Risco de "perder" parcela legítima por falha transitória.
    - **Recomendação concreta:** adicionar contador `failedAttempts` em `recurrence_occurrences` e cap configurável (default ilimitado para MVP, com aviso).

- [x] `RCREV-DEF-07` Deduplicação de pendências no forecast:
  - Definição:
    - excluir `materialized`, `pending_review` e `skipped` da projeção calculada.
    - `pending_review` entra em `projected` pelos dados persistidos, não pela projeção futura.
  - Avaliação:
    - **Recomendação:** manter. Sem essa regra o forecast duplica datas (uma vez como persistida, outra como projetada).
    - **Implementação:** o filtro atual no `recurrence-forecast.service.ts` cobre apenas `materialized`/`failed`. Precisa expandir — já está em `RCREV-S2-07`.
    - **Risco:** se a janela de projeção começar antes da `nextOccurrenceDate`, datas com pendência podem ser geradas pela projeção e pelos dados persistidos. Garantir que a projeção sempre comece a partir de `nextOccurrenceDate`.
    - **Teste essencial:** criar recorrência mensal `review_required`, gerar 3 pendências, conferir que o forecast retorna 3 (não 6).

- [x] `RCREV-DEF-08` Separação entre snapshot de negócio e metadados técnicos:
  - Definição:
    - usar `reviewPayload` para snapshot de negócio e `metadata` para metadados técnicos.
  - Avaliação:
    - **Recomendação:** manter. Mistura geraria payloads opacos e dificultaria evolução do schema.
    - **Definição complementar:** documentar o que vai em cada um:
      - `reviewPayload`: campos do form (amount, date, account, category, etc.) — usado pelo confirm.
      - `metadata`: origem (`source: 'job' | 'submit' | 'admin'`), tentativas, timestamp da geração, requestId, erro técnico em `failed`.
    - **Risco se mudar depois:** médio — mover dados entre colunas exige migration de leitura.
    - **Pendente correlacionado:** `RCREV-DEF-19` define o tipo da coluna `reviewPayload` (`jsonb`).

- [x] `RCREV-DEF-09` Metadados de janela parcial na timeline:
  - Definição:
    - retornar metadados explícitos: `appliedLimit`, `isPartial`, `hasMoreProjected` e, quando aplicável, `projectionWindowLabel`.
  - Avaliação:
    - **Recomendação:** manter. Sem isso a UI não sabe se deve mostrar "carregar mais" ou se está vendo a série completa.
    - **Definição complementar:** `projectionWindowLabel` precisa de exemplo concreto para o frontend:
      - `endType=never` com `limit=24`: `"Próximas 24 ocorrências"`.
      - `endType=until_date` truncado: `"Até dd/mm/aaaa (parcial)"`.
      - `endType=by_occurrences` completo: `null` (todas mostradas).
    - **Pendente correlacionado:** `RCREV-DEF-23` define quando `hasMoreProjected = true`.

- [x] `RCREV-DEF-10` Modos de lançamento:
  - Definição:
    - `automatic` mantém comportamento atual.
    - `review_required` gera pendência para confirmação manual.
  - Avaliação:
    - **Recomendação:** manter. Dois modos atendem 95% dos casos sem complicar.
    - **Alternativa avaliada:** terceiro modo `notify_only` (notifica mas não cria pendência nem transação). Útil para "lembretes" mas adiciona estado e UX. Fora do MVP.
    - **Pendente correlacionado:** `RCREV-DEF-15` cobre transição entre os dois modos.
    - **Risco:** se `review_required` virar default da maioria dos usuários, o trabalho manual pode anular o ganho de automatização. Telemetria de uso pós-lançamento ajuda a calibrar.

- [x] `RCREV-DEF-11` Pendência ignorada consome limite:
  - Definição:
    - ocorrência com status `skipped` conta no consumo de `by_occurrences`.
  - Avaliação:
    - **Recomendação:** manter. Sem isso, série `by_occurrences` com revisão pode gerar pendências infinitas se o usuário ignorar todas (`RCREV-CNF-02`).
    - **Alternativa avaliada:** skip não consume mas tem cap (ex.: máximo 3 skips na série). Adiciona regra arbitrária e UX confusa.
    - **Trade-off:** usuário que ignorar por engano "perde" parcela. Mitigado por aviso na UI antes do skip.
    - **Pendente correlacionado:** `RCREV-DEF-03` (reabertura). Se reabertura entrar em v2, esta regra precisa de tratamento especial.

- [x] `RCREV-DEF-12` Compra parcelada:
  - Definição:
    - parcelamento será representado por recorrência `by_occurrences`, onde cada ocorrência é uma parcela.
  - Avaliação:
    - **Recomendação:** manter. Reusa modelo existente sem criar entidade nova.
    - **Alternativa avaliada:** entidade `Installment` separada com vínculo a `Transaction`. Mais clara para o domínio "parcelamento" mas duplica calendário, consumo de saldo, etc.
    - **Trade-off:** UX precisa traduzir "recorrência mensal por 10 ocorrências, valor R$ 200" em "10x R$ 200". Form precisa de atalho específico para parcelamento (botão "Parcelar"); senão o usuário vai sentir que está usando uma feature genérica.
    - **Recomendação concreta:** considerar etiqueta visual no modal de detalhe quando `originType=transaction` e `endType=by_occurrences` — mostrar "Parcela X de N" em vez de "Ocorrência X".

- [x] `RCREV-DEF-13` Modal de detalhe:
  - Definição:
    - frontend deve ter modal de detalhe da recorrência com resumo e tabela de ocorrências.
  - Avaliação:
    - **Recomendação:** manter modal. Drawer lateral é alternativa válida mas modal é consistente com o padrão atual do sistema (transactions, accounts).
    - **Alternativa avaliada:** página dedicada (`/app/recurrences/:id`). Permite deep-link e melhor responsividade no mobile, mas adiciona route + guard.
    - **Trade-off:** modal não tem deep-link. Se isso for valorizado depois, migrar para route.
    - **Recomendação concreta:** já planejar o modal com layout que sirva de base para futura página (mesmos sub-componentes).

- [x] `RCREV-DEF-14` Estratégia de migration/backfill:
  - Definição:
    - criar migration com default/backfill de `postingMode = automatic`, expansão segura do enum de status e validação de compatibilidade com ocorrências existentes.
    - ocorrências existentes (`materialized`/`failed`) não são tocadas pela migration — preservar status.
  - Avaliação:
    - **Recomendação:** manter. Backfill conservador é correto para evitar mudança implícita de comportamento.
    - **Pendente correlacionado:** `RCREV-CNF-08` (separar `ALTER TYPE ADD VALUE` em migration própria).
    - **Risco:** se a migration falhar no meio, podemos ficar com enum expandido mas sem coluna `postingMode` — service novo pode quebrar. Mitigar com:
      - migrations idempotentes (`IF NOT EXISTS` onde possível).
      - validar em staging com dump de produção antes de deploy.
      - ter plano de rollback documentado (drop da coluna `postingMode`, sem reverter enum — `ALTER TYPE DROP VALUE` não existe no Postgres).
    - **Recomendação concreta:** documentar passo-a-passo de rollback no próprio PR da migration.

- [x] `RCREV-DEF-15` Edição de `postingMode` em recorrência existente:
  - Definição:
    - permitir alternar `automatic ↔ review_required` em recorrência ativa.
    - `automatic → review_required`: novas ocorrências geradas pelo job passam a ser pendência; ocorrências passadas não são afetadas.
    - `review_required → automatic`: exigir resolução manual de todas as pendências abertas antes de permitir a mudança (Opção A — mais conservador). Backend deve bloquear com 422 se houver `pending_review` em aberto.

- [x] `RCREV-DEF-16` Finalização/exclusão de recorrência com pendências abertas:
  - Definição:
    - bloquear finalização (`status = finalized`) e exclusão (soft delete) enquanto existirem pendências `pending_review` em aberto.
    - backend retorna 422 com lista dos ids de pendências bloqueantes.
    - UI deve oferecer "ignorar todas as pendências" como atalho antes de finalizar/excluir.

- [x] `RCREV-DEF-17` Reprocessamento de status `failed`:
  - Definição:
    - fora do MVP — manter `failed` apenas como observabilidade.
    - reprocessamento manual via SQL ou criação de nova ocorrência manual pelo usuário.
    - rota `POST /recurrences/occurrences/:id/retry` fica planejada para v2.

- [x] `RCREV-DEF-18` Edição com escopo `single` em data com `pending_review`:
  - Definição:
    - edição com escopo `single` sobre uma data que possui `pending_review` deve atualizar o `reviewPayload` da pendência, não a regra-mãe.
    - `this_and_next` e `all` afetam apenas ocorrências ainda não geradas; pendências existentes mantêm o snapshot original (`RCREV-DEF-04`).
    - `single` em data futura sem pendência gerada mantém comportamento atual (atualiza regra-mãe com escopo restrito).

- [x] `RCREV-DEF-19` Tipo da coluna `reviewPayload`:
  - Definição:
    - `jsonb`, consistente com a coluna `metadata` já existente.
    - schema Zod (`RecurrenceOccurrenceReviewPayload`) aplicado no service para parse e validação ao confirmar — o banco não valida a estrutura interna.

- [x] `RCREV-DEF-20` Regras de `canConfirm` e `canSkip` na timeline:
  - Definição:
    - `canConfirm = true` apenas se `status === 'pending_review'`, recorrência ativa (não finalizada/deletada) e usuário é dono.
    - `canSkip = true` nas mesmas condições de `canConfirm`.
    - todos os outros status (`materialized`, `skipped`, `failed`, `projected`) retornam `false` para ambos.
    - cálculo feito no service de timeline; frontend não recalcula.

- [x] `RCREV-DEF-21` Manutenção do unique constraint de idempotência:
  - Definição:
    - manter `unique (recurrenceId, occurrenceDate, originType)` sem alteração.
    - a transição `pending_review → materialized` ocorre via UPDATE na mesma linha — nunca INSERT de nova linha — preservando o constraint e a idempotência.
    - documentar esse invariante no service de confirmação para evitar regressão futura.

- [x] `RCREV-DEF-22` Expansão de `AuditAction`:
  - Definição:
    - estender o enum `AuditAction` com `materialize_pending`, `confirm`, `skip`, `fail`.
    - registrar entidade `recurrence_occurrence` (além de `recurrence`) no audit.
    - se o enum for compartilhado globalmente, prefixar com `recurrence_occurrence_*` para evitar colisão semântica com outras entidades.

- [x] `RCREV-DEF-23` Semântica de `sequence` e `hasMoreProjected` na timeline:
  - Definição:
    - `sequence`: numérico (1..N) em `endType = by_occurrences`; `null` em `endType = never` e `endType = until_date` — sequência infinita ou aberta não faz sentido como "parcela X".
    - `hasMoreProjected = true` quando o cálculo foi cortado por `appliedLimit` antes do fim natural da série — ou seja, quando ainda há ocorrências futuras além das retornadas (série sem fim, `until_date` não atingido, ou `by_occurrences` com parcelas restantes não mostradas).

- [x] `RCREV-DEF-24` Cálculo de `sequence` em séries com gaps (`endType = by_occurrences`):
  - Definição:
    - `sequence` é a posição cronológica da ocorrência na série, contando todas (`materialized`, `pending_review`, `skipped`, `failed`, `projected`), independente do status.
    - `skipped` ocupa posição — coerente com `RCREV-DEF-11` (skip consome `by_occurrences`).
    - exibição na UI: "Parcela 3/10" mesmo em ocorrência `skipped`, deixando claro que aquela posição foi consumida.

- [x] `RCREV-DEF-25` Limite de range para `occurrenceDate` no payload de confirm:
  - Definição:
    - aceitar ajuste dentro de `[startDate, endDate]` da regra-mãe quando ambos estiverem definidos.
    - quando `endType = never`, aceitar qualquer data `>= startDate` validando contra `now() + 1 ano` (evita erros de digitação como `2030`).
    - quando `endType = until_date`, aplicar `[startDate, endDate]` normalmente.
    - quando `endType = by_occurrences` sem `endDate`, aplicar a mesma regra de `never` (limite superior `now() + 1 ano`).
    - validar no service e retornar 422 com mensagem clara em PT-BR.

- [x] `RCREV-DEF-26` Status da primeira ocorrência em criação aninhada com `review_required`:
  - Definição:
    - em criação aninhada via `POST /transactions` ou `POST /transfers`, a primeira `recurrence_occurrences` sempre nasce com `status = materialized`, independente de `postingMode`.
    - reflete a ação intencional do usuário no submit do form — a transação/transferência já existe.
    - próximas ocorrências geradas pelo job seguem `postingMode`: em `review_required` nascem como `pending_review`; em `automatic` nascem como `materialized`.
    - documentar esse invariante no service de criação aninhada para evitar regressão futura.

- [x] `RCREV-DEF-27` Visibilidade global de pendências do usuário:
  - Definição:
    - no MVP, exibir contador/badge na listagem de recorrências indicando "X pendências" por linha.
    - sem endpoint global novo no MVP — a leitura é derivada do agregado já disponível por recorrência.
    - tela "Inbox de pendências" e endpoint `GET /recurrences/occurrences/pending` ficam para v2, justificada por telemetria de uso.

- [x] `RCREV-DEF-28` Filtro de conta no forecast com pendências persistidas:
  - Definição:
    - filtrar pendências pela conta da regra-mãe (`recurrences.accountId` para transações; `recurrences.fromAccountId`/`toAccountId` para transferências), não pelo `reviewPayload`.
    - ajuste de conta no confirm é caso de borda; tratá-lo via `reviewPayload->>'accountId'` exigiria índice GIN/functional sem ganho proporcional no MVP.
    - documentar divergência possível: pendência confirmada com conta diferente da regra pode "saltar" entre buckets de forecast quando virar `materialized`. Aceito como trade-off do MVP.

- [x] `RCREV-DEF-29` Ordem técnica das migrations e estratégia drizzle-kit:
  - Definição:
    - **Sequência de migrations**:
      1. Migration A — `ALTER TYPE recurrence_occurrence_status ADD VALUE 'pending_review'` e `ADD VALUE 'skipped'` (ambos juntos; sem usar os valores nesta migration).
      2. Migration B — `ALTER TABLE recurrences ADD COLUMN posting_mode recurrence_posting_mode_enum NOT NULL DEFAULT 'automatic'` (criar enum novo se necessário); `ALTER TABLE recurrence_occurrences ADD COLUMN version integer NOT NULL DEFAULT 1`; `ALTER TABLE recurrence_occurrences ADD COLUMN review_payload jsonb`.
      3. Migration C — backfill explícito (`UPDATE recurrences SET posting_mode = 'automatic' WHERE posting_mode IS NULL`) — redundante por causa do default mas garante idempotência se a coluna for criada como NULL primeiro.
    - **Estratégia drizzle-kit**:
      - usar `drizzle-kit generate` como ponto de partida, mas revisar e ajustar SQL manualmente — drizzle-kit pode gerar `DROP TYPE / CREATE TYPE` para alterações de enum (perigoso com dados existentes).
      - para `ALTER TYPE ADD VALUE`, escrever SQL bruto em arquivo de migration manual (`drizzle/migrations/NNNN_*.sql`) — drizzle aplica via `drizzle-kit migrate` sem reinterpretar.
      - validar o SQL gerado em ambiente de staging com dump de produção antes de aplicar.
    - **Plano de rollback documentado no PR**:
      - rollback de Migration B/C: `DROP COLUMN posting_mode/version/review_payload`.
      - rollback de Migration A: não é possível remover valor do enum sem recriar o tipo (operação destrutiva); aceitar enum estendido como permanente após Migration A.
    - referência: `RCREV-CNF-08`, `RCREV-S2-02A`, `RCREV-DEF-14`.

- [x] `RCREV-DEF-30` Estratégia de mensagens de erro em PT-BR:
  - Definição:
    - backend retorna `detail` em PT-BR para erros de domínio (4xx que o usuário precisa entender): 422, 409, e mensagens específicas de 400.
    - 401, 403, 500 mantêm formato técnico atual — frontend traduz via `apiError.ts` se necessário.
    - exemplos:
      - 422 `RCREV-DEF-25`: `"A data ajustada deve estar entre 01/05/2026 e 30/04/2027."`
      - 409 `RCREV-CNF-06`: `"Esta pendência já foi processada por outra requisição. Atualize a página e tente novamente."`
      - 422 `RCREV-DEF-16`: `"Esta recorrência possui pendências em aberto. Resolva-as antes de finalizar."`
    - manter convenção em `apiError.ts`: `getApiErrorMessage()` consome `detail` cru sem tradução adicional para erros 4xx.

- [x] `RCREV-DEF-31` UX da confirmação de pendência:
  - Definição:
    - clicar "Confirmar" em uma pendência abre modal de edição (`ConfirmRecurrenceOccurrenceModal`) com os campos do `reviewPayload` pré-preenchidos.
    - usuário pode ajustar: `occurrenceDate`, `amount`, `description`, `notes`, `accountId`, `categoryId`, `subcategoryId` (transação) ou `fromAccountId`/`toAccountId` (transferência).
    - botões: `Confirmar lançamento` (envia request com `expectedVersion`) e `Cancelar` (fecha sem alteração).
    - reutilizar componentes de campo existentes (`TransactionAccountField`, `TransactionAmountField`, etc.) — alinhado com `RCREV-S3-07`.
    - skip continua sendo ação direta (sem modal de edição) — opcional capturar `reason` em prompt simples.

- [x] `RCREV-DEF-32` `failedAttempts` e cap no MVP:
  - Definição:
    - **fora do MVP**. Mantém aceite consciente de `RCREV-CNF-12` — `failed` é terminal sem caminho de recuperação automática.
    - recomendação operacional para o MVP: criar consulta SQL pronta (em doc operacional) para listar `recurrences` com ocorrências `failed` recorrentes, permitindo intervenção manual.
    - planejar para v2: coluna `failedAttempts` em `recurrence_occurrences`, cap configurável e rota `POST /recurrences/occurrences/:id/retry`.

- [x] `RCREV-DEF-33` Cleanup automático de pendências antigas:
  - Definição:
    - **fora do MVP**. Pendências `pending_review` persistem indefinidamente até ação do usuário (confirm/skip) ou finalização da recorrência.
    - razões: volume esperado baixo no MVP; expiração automática traria regra de negócio adicional (consumir/não-consumir, notificar usuário).
    - planejar para v2 se telemetria mostrar acúmulo de pendências antigas (>90 dias sem ação).

- [x] `RCREV-DEF-34` Conteúdo padrão de `metadata` em pendências:
  - Definição:
    - estrutura típica de `recurrence_occurrences.metadata` (jsonb):
      ```ts
      type RecurrenceOccurrenceMetadata = {
        source: 'job' | 'submit' | 'admin'
        jobRunId?: string
        generatedAt: string
        confirmedAt?: string
        skippedAt?: string
        skipReason?: string
        failedAt?: string
        failureReason?: string
        adjustments?: {
          fields: string[]
          adjustedAt: string
        }
      }
      ```
    - `source` identifica origem da geração; `jobRunId` correlaciona com logs do job; `adjustments` registra quais campos foram alterados no confirm em relação ao `reviewPayload` original.
    - schema Zod aplicado no service ao gravar; banco não valida a estrutura interna (consistente com `RCREV-DEF-19`).

- [x] `RCREV-DEF-35` Estratégia de "lembrete" para recorrências `review_required`:
  - Definição:
    - **MVP entrega "lembrete passivo"** — pendência aparece no app quando o usuário abre, sinalizada por badge na listagem de recorrências (`RCREV-DEF-27`).
    - **sem notificação ativa no MVP** — nada de push, email, SMS, banner global ou alerta antecipado.
    - cobertura adequada para casos comuns: compra parcelada, aluguel, mensalidade e serviço recorrente, desde que o usuário abra o app com regularidade (semanal ou maior).
    - pendência é gerada **na data do vencimento** (`occurrenceDate = nextOccurrenceDate`); não há antecedência configurável.
    - sem distinção visual de urgência entre pendências (vencendo hoje vs vencida há 10 dias) no MVP.
    - planejar para v2: campo `notifyDaysBefore` na recorrência, banner in-app na home, push/email opcional, badge com diferenciação visual por urgência.

## Modelo de domínio proposto

Campos novos ou alterados:

- `recurrences.postingMode`
  - valores: `automatic`, `review_required`
  - default sugerido: `automatic`
- `recurrence_occurrences.status`
  - valores propostos: `pending_review`, `materialized`, `skipped`, `failed`
- `recurrence_occurrences.metadata`
  - manter para origem técnica, detalhes operacionais e auditoria auxiliar.
- `recurrence_occurrences.reviewPayload`
  - snapshot de negócio usado para confirmar pendência sem depender de mudanças futuras na regra-mãe.
  - tipo da coluna: `jsonb` (ver `RCREV-DEF-19`).
- `recurrence_occurrences.version`
  - inteiro com default `1`, incrementado a cada transição de estado (confirm/skip/retry).
  - usado como lock otimista para evitar duplo confirm/skip (ver `RCREV-CNF-06`).

Snapshot recomendado para pendência:

```ts
type RecurrenceOccurrenceReviewPayload = {
  occurrenceDate: string
  originalScheduledDate: string
  originType: 'transaction' | 'transfer'
  amount: number
  description: string | null
  notes: string | null
  accountId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  fromAccountId?: string | null
  toAccountId?: string | null
}
```

Notas:

- `originalScheduledDate` preserva a data agendada original (antes de ajuste no confirm), útil para auditoria e para diferenciar "data do lançamento" de "data da ocorrência da regra".
- `occurrenceDate` no snapshot pode divergir de `recurrence_occurrences.occurrenceDate` quando o usuário ajustar a data no confirm; a coluna de banco continua sendo a referência da regra.

Estados de ocorrência na UI:

- `Pendente revisão`: `pending_review`
- `Lançada`: `materialized`
- `Ignorada`: `skipped`
- `Falhou`: `failed`
- `Prevista`: calculada pela timeline, ainda não persistida

## Contratos de API propostos

### Listar timeline da recorrência

```txt
GET /recurrences/:id/timeline
```

Query sugerida:

- `limit` opcional, default `24`.
- `limit` máximo `120`.
- `untilDate` opcional para limitar horizonte.
- `includeProjected` opcional, default `true`.

Resposta sugerida:

```ts
type RecurrenceTimelineResponse = {
  recurrence: Recurrence
  summary: {
    totalOccurrences: number | null
    consumedOccurrences: number
    materializedOccurrences: number
    pendingReviewOccurrences: number
    skippedOccurrences: number
    failedOccurrences: number
    projectedOccurrences: number
    totalAmount: number | null
    materializedAmount: number
    pendingReviewAmount: number
    projectedAmount: number
    appliedLimit: number
    isPartial: boolean
    hasMoreProjected: boolean
    projectionWindowLabel: string | null
  }
  items: Array<{
    id: string | null
    sequence: number | null
    occurrenceDate: string
    status:
      | 'pending_review'
      | 'materialized'
      | 'skipped'
      | 'failed'
      | 'projected'
    source: 'persisted' | 'projected'
    amount: number
    transactionId: string | null
    transferId: string | null
    canConfirm: boolean
    canSkip: boolean
  }>
}
```

Regras (ver `RCREV-DEF-20` e `RCREV-DEF-23`):

- `canConfirm = true` apenas se `status === 'pending_review'`, recorrência não finalizada/deletada e usuário é dono.
- `canSkip` segue as mesmas regras de `canConfirm`.
- `sequence` é numérico (1..N) em `endType = by_occurrences` e `null` em `endType = never` ou `endType = until_date`.
- `hasMoreProjected = true` quando o cálculo cortou por `appliedLimit` antes do fim natural da série.

### Confirmar pendência

```txt
POST /recurrences/occurrences/:id/confirm
```

Payload sugerido:

```ts
type ConfirmRecurrenceOccurrencePayload = {
  expectedVersion: number
  occurrenceDate?: string
  amount?: number
  description?: string | null
  notes?: string | null
  accountId?: string
  categoryId?: string
  subcategoryId?: string | null
  fromAccountId?: string
  toAccountId?: string
}
```

Erros esperados:

- `409 Conflict` quando `expectedVersion` não bate com o estado atual da ocorrência (já confirmada/ignorada por outro request).
- `404 Not Found` quando ocorrência não existe ou não pertence ao usuário.
- `422 Unprocessable Entity` quando ocorrência não está em `pending_review`.

### Ignorar pendência

```txt
POST /recurrences/occurrences/:id/skip
```

Payload sugerido:

```ts
type SkipRecurrenceOccurrencePayload = {
  expectedVersion: number
  reason?: string
}
```

Mesmos códigos de erro do confirm.

## UX planejada

Na lista de recorrências:

- adicionar ação `Ver detalhes`.
- manter ações existentes de editar, finalizar e excluir.

No modal de detalhe:

- cabeçalho com descrição, status da regra, frequência e modo de lançamento.
- cards de resumo:
  - parcelas lançadas.
  - pendentes de revisão.
  - ignoradas.
  - previstas.
  - total previsto.
  - total lançado.
  - total pendente.
- tabela de ocorrências:
  - parcela/sequência.
  - data.
  - status.
  - valor.
  - conta/categoria ou origem/destino.
  - ações.

Exemplo de tabela para compra parcelada:

| Parcela | Data | Status | Valor | Conta/Categoria | Ação |
| --- | --- | --- | --- | --- | --- |
| 1/10 | 10/05/2026 | Lançada | $ 200,00 | Cartão · Eletrônicos | Ver transação |
| 2/10 | 10/06/2026 | Lançada | $ 200,00 | Cartão · Eletrônicos | Ver transação |
| 3/10 | 10/07/2026 | Pendente revisão | $ 200,00 | Cartão · Eletrônicos | Confirmar / Ignorar |
| 4/10 | 10/08/2026 | Prevista | $ 200,00 | Cartão · Eletrônicos | - |

Labels de UI:

- `Lançar automaticamente`
- `Revisar antes de lançar`
- `Pendente revisão`
- `Lançada`
- `Ignorada`
- `Prevista`
- `Falhou`
- `Confirmar lançamento`
- `Ignorar ocorrência`

## Critérios de engenharia (rigor e evolução)

- consistência temporal:
  - cálculo por data ISO e timezone da regra/usuário.
  - `review_required` deve usar o mesmo motor de calendário do modo automático.
- separação de responsabilidades:
  - cálculo de agenda centralizado.
  - confirmação de pendência separada da materialização automática.
  - frontend sem duplicar regra crítica além de validações UX.
- rastreabilidade:
  - auditoria para confirmação, skip e falha.
  - metadata com origem da operação.
- migrations:
  - `ALTER TYPE ADD VALUE` em migration própria, sem uso no mesmo step (`RCREV-CNF-08`).
  - backfill conservador de `postingMode = automatic`.
  - preservar status atuais de `recurrence_occurrences` existentes.
- concorrência:
  - lock otimista em `recurrence_occurrences.version` para confirm/skip.
  - transição de estado via `UPDATE ... WHERE status = 'pending_review'` para garantir atomicidade.
- estratégia de testes:
  - unitário para calendário e contagem.
  - integração para materialização automática, pendência, confirmar e ignorar.
  - integração para concorrência (confirm duplicado), idempotência do job, e rollback de transferência.
  - integração frontend para modal de detalhe e ações.
- convenção de nomenclatura:
  - código backend/frontend técnico em inglês.
  - UI em pt-BR.

## Critérios de aceite

- [ ] Recorrência `automatic` mantém comportamento atual.
- [ ] Recorrência `review_required` cria pendência e não cria transação automaticamente.
- [ ] Pendência confirmada cria transação/transferência correta e muda status para `materialized`.
- [ ] Pendência ignorada muda status para `skipped` e consome `by_occurrences`.
- [ ] Compra parcelada `by_occurrences` exibe parcelas lançadas, pendentes, ignoradas e previstas.
- [ ] Timeline limita projeção para recorrências sem fim.
- [ ] Transferência confirmada cria duas pernas atomicamente.
- [ ] Forecast não duplica valores já materializados ou ignorados.
- [ ] Forecast não duplica datas já persistidas como `pending_review`.
- [ ] Frontend exibe modal de detalhe com tabela de ocorrências.
- [ ] Auditoria registra ações críticas.
- [ ] Confirm/skip rejeita request com `expectedVersion` desatualizado (409).
- [ ] Job re-executado em janela com pendências geradas não cria pendência duplicada (idempotência).
- [ ] `nextOccurrenceDate` avança ao gerar `pending_review`; `lastMaterializedDate` só atualiza em `materialized`.
- [ ] Listagem de transações (`GET /transactions`) não retorna pendências (apenas `materialized`).
- [ ] Endpoint admin `POST /recurrences/materialize` em recorrência `review_required` gera pendência, não transação.
- [ ] Geração de pendências respeita `endOccurrences` — não excede o limite (`RCREV-CNF-10`).
- [ ] Forecast com pendências persistidas não duplica datas (`RCREV-CNF-11`).
- [ ] Primeira ocorrência criada via aninhado nasce como `materialized` mesmo em `review_required` (`RCREV-DEF-26`).
- [ ] Confirm com `occurrenceDate` fora do range permitido retorna 422 (`RCREV-DEF-25`).
- [ ] Migrations executadas na ordem A → B → C sem erro em produção (`RCREV-DEF-29`).
- [ ] Mensagens de erro 4xx críticos retornam `detail` em PT-BR (`RCREV-DEF-30`).
- [ ] Confirm de pendência abre modal de edição com campos do `reviewPayload` editáveis (`RCREV-DEF-31`).
- [ ] `metadata.adjustments` é gravado quando o usuário ajusta campos no confirm (`RCREV-DEF-34`).

## Checklist step-by-step

### Sprint A - Regras e dados

- [ ] `RCREV-S1-01` Formalizar contratos de `postingMode` e status de ocorrência.
- [x] `RCREV-S1-02` Definir política de contagem de `by_occurrences`.
- [x] `RCREV-S1-03` Confirmar que `skipped` consome `by_occurrences`.
- [ ] `RCREV-S1-04` Modelar schema/migração de `postingMode` e status.
- [x] `RCREV-S1-05` Definir snapshot de pendência.
- [x] `RCREV-S1-06` Definir limites da timeline para recorrência sem fim.
- [x] `RCREV-S1-07` Fechar semântica de `failed`.
- [x] `RCREV-S1-08` Fechar deduplicação de pendências no forecast.
- [x] `RCREV-S1-09` Fechar estratégia de migration/backfill.

### Sprint B - Backend

- [x] `RCREV-S2-01` Adicionar `postingMode` aos schemas e rotas de recorrência.
- [x] `RCREV-S2-02` Expandir status de `recurrence_occurrences`.
- [x] `RCREV-S2-02A` Implementar migration/backfill de `postingMode = automatic` e expansão segura de enum/status (separar `ALTER TYPE ADD VALUE` em migration própria — `RCREV-CNF-08`).
- [x] `RCREV-S2-02B` Adicionar coluna `version` em `recurrence_occurrences` para lock otimista (`RCREV-CNF-06`).
- [x] `RCREV-S2-02C` Adicionar coluna `reviewPayload` (`jsonb`) em `recurrence_occurrences`.
- [x] `RCREV-S2-02D` Adicionar índice composto em `recurrence_occurrences (recurrence_id, status)` para suportar agregação de pendências por recorrência (badge da listagem — `RCREV-S3-10`) sem table scan. Avaliar índice parcial `WHERE status = 'pending_review'` se cardinalidade justificar.
- [x] `RCREV-S2-02E` Implementar migrations seguindo a sequência definida em `RCREV-DEF-29` (3 migrations separadas) e usar SQL bruto para `ALTER TYPE ADD VALUE`. Documentar plano de rollback no PR.
- [x] `RCREV-S2-03` Alterar materialização para gerar `pending_review` quando `postingMode = review_required`.
  - sub-task: atualizar a query de contagem de `by_occurrences` em `recurrence-materialize.service.ts:231` para `inArray(status, ['materialized', 'pending_review', 'skipped'])` (`RCREV-CNF-10`).
- [x] `RCREV-S2-03A` Garantir que `nextOccurrenceDate` avança ao gerar pendência e `lastMaterializedDate` só atualiza em `materialized` (`RCREV-CNF-07`).
- [x] `RCREV-S2-03B` Ajustar `POST /recurrences/materialize` (admin/job) para respeitar `postingMode` (`RCREV-CNF-09`).
- [x] `RCREV-S2-03C` Garantir que primeira ocorrência em criação aninhada (`POST /transactions`/`POST /transfers`) sempre nasce como `materialized` independente de `postingMode` (`RCREV-DEF-26`).
- [x] `RCREV-S2-04` Implementar confirmação de pendência (com `expectedVersion`, dentro de transação de banco).
  - sub-task: validar `occurrenceDate` ajustado dentro do range definido em `RCREV-DEF-25`.
  - sub-task: aplicar `auth` preHandler na rota; validar ownership dentro do service.
  - sub-task: registrar campos ajustados em `metadata.adjustments` conforme `RCREV-DEF-34`.
  - sub-task: retornar `detail` em PT-BR conforme `RCREV-DEF-30`.
- [x] `RCREV-S2-05` Implementar skip de pendência (com `expectedVersion`).
  - sub-task: aplicar `auth` preHandler na rota.
  - sub-task: gravar `metadata.skipReason` quando enviado.
- [x] `RCREV-S2-06` Implementar timeline da recorrência.
  - sub-task: calcular `sequence` conforme regra de `RCREV-DEF-24` (contar todos os status, incluindo `skipped`). `sequence` é calculado apenas no service de timeline — não em outras listagens (custo desnecessário).
  - sub-task: aplicar `auth` preHandler e validar ownership da recorrência.
- [x] `RCREV-S2-07` Ajustar forecast — alterar filtros existentes para excluir também `pending_review` e `skipped` da projeção.
  - sub-task crítica (`RCREV-CNF-11`): expandir `materializedDateSet` (`recurrence-forecast.service.ts:150`) e `materializedCountByRecurrence` (`:132`) para `inArray(status, ['materialized', 'pending_review', 'skipped'])`. Renomear variáveis para `consumedDateSet`/`consumedCountByRecurrence`.
  - sub-task: filtrar pendências pela conta da regra-mãe, não pelo `reviewPayload` (`RCREV-DEF-28`).
  - sub-task: validar branch `endOccurrences = null` (recorrências `never`/`until_date`) — `consumedCountByRecurrence` continua sendo populado, mas `remainingOccurrences` não é calculado nesse branch. Garantir que a renomeação não introduza regressão na projeção sem fim.
- [x] `RCREV-S2-08` Revisar criação aninhada em `POST /transactions` e `POST /transfers` — confirmar que `resolveSubmitOccurrence()` cobre o caso e que a primeira ocorrência fica vinculada à transação.
- [x] `RCREV-S2-09` Adicionar auditoria — expandir `AuditAction` com novas ações (`RCREV-DEF-22`) e registrar entidade `recurrence_occurrence`.
- [x] `RCREV-S2-10` Tratar finalização/exclusão de recorrência com pendências abertas (`RCREV-DEF-16`). Validação adicionada em `recurrence-edit-service` / `recurrence.service.ts` (caminhos de finalize e remove). Retornar 422 com lista de IDs em PT-BR.
- [x] `RCREV-S2-11` Tratar edição de `postingMode` em recorrência existente (`RCREV-DEF-15`). Implementar a validação no `recurrence-edit-service` — bloquear `review_required → automatic` quando houver `pending_review` em aberto (count > 0).
- [x] `RCREV-S2-12` Tratar edição com escopo `single` em data com `pending_review` (`RCREV-DEF-18`). O `recurrence-edit-service` deve detectar a existência de `pending_review` na data alvo e roteá-la para atualização do `reviewPayload` (não da regra-mãe).
- [x] `RCREV-S2-13` Documentar no service e no doc operacional que `failed` é estado terminal no MVP (`RCREV-CNF-12`). Incluir SQL de diagnóstico (`SELECT recurrence_id, COUNT(*) FROM recurrence_occurrences WHERE status='failed' GROUP BY recurrence_id`) no doc operacional (`RCREV-DEF-32`).

### Sprint C - Frontend / UX

- [x] `RCREV-S3-01` Atualizar tipos e client API de recorrência (incluir `postingMode`, `RecurrenceOccurrence`, timeline).
- [x] `RCREV-S3-02` Adicionar campo de modo no formulário.
- [x] `RCREV-S3-03` Criar ação `Ver detalhes` na listagem.
- [x] `RCREV-S3-04` Criar modal de detalhe da recorrência.
- [x] `RCREV-S3-05` Criar tabela de ocorrências/parcelas.
- [x] `RCREV-S3-06` Criar ações de confirmar e ignorar pendência (enviar `expectedVersion` e tratar 409 com refetch).
  - sub-task: criar `ConfirmRecurrenceOccurrenceModal` com campos do `reviewPayload` editáveis, reusando `TransactionAccountField`, `TransactionAmountField`, `TransactionCategoryField`, etc. (`RCREV-DEF-31`).
  - sub-task: skip envia request direto (sem modal de edição); opcional capturar `reason` em prompt simples.
- [x] `RCREV-S3-07` Revisar fluxo de nova transação/transferência recorrente para usar criação aninhada — converger lógica de `useTransactionRecurrenceDraft` e remover dupla mutação.
- [x] `RCREV-S3-08` Tratar estados de loading, vazio e erro.
- [x] `RCREV-S3-09` Tratar UI de finalização/exclusão com pendências abertas (alerta + opção de skip em massa).
- [x] `RCREV-S3-10` Adicionar badge/contador de pendências por linha na listagem de recorrências (`RCREV-DEF-27`).
- [x] `RCREV-S3-11` Tratar resposta 422 do confirm quando `occurrenceDate` ajustado estiver fora do range (`RCREV-DEF-25`) com mensagem clara em PT-BR.

### Sprint D - Testes

- [x] `RCREV-S4-01` Testar cálculo e contagem de ocorrências.
- [x] `RCREV-S4-02` Testar materialização automática sem regressão.
- [x] `RCREV-S4-03` Testar geração de pendência.
- [ ] `RCREV-S4-04` Testar confirmação de transação.
- [x] `RCREV-S4-05` Testar confirmação de transferência atômica (rollback se uma perna falhar).
- [x] `RCREV-S4-06` Testar skip consumindo `by_occurrences`.
- [ ] `RCREV-S4-07` Testar timeline com persistidas e projetadas.
- [ ] `RCREV-S4-08` Testar modal de detalhe no frontend.
- [ ] `RCREV-S4-09` Testar concorrência: dois confirms simultâneos — segundo deve receber 409.
- [ ] `RCREV-S4-10` Testar idempotência do job: rodar 2x na mesma janela não duplica `pending_review`.
- [ ] `RCREV-S4-11` Testar avanço de `nextOccurrenceDate` em `review_required` (sem alterar `lastMaterializedDate`).
- [ ] `RCREV-S4-12` Testar que `GET /transactions` não retorna pendências.
- [ ] `RCREV-S4-13` Testar alteração de `postingMode` em recorrência ativa (ambos sentidos).
- [ ] `RCREV-S4-14` Testar finalização/exclusão com pendências abertas conforme `RCREV-DEF-16`.
- [ ] `RCREV-S4-15` Testar `POST /recurrences/materialize` em recorrência `review_required`.
- [ ] `RCREV-S4-16` Testar cap de geração: criar recorrência `by_occurrences=3` em `review_required`, rodar job 5x; total de pendências geradas deve ser exatamente 3 (`RCREV-CNF-10`).
- [ ] `RCREV-S4-17` Testar deduplicação no forecast: criar recorrência mensal `review_required`, gerar 3 pendências; forecast deve retornar 3 itens, não 6 (`RCREV-CNF-11`).
- [ ] `RCREV-S4-18` Testar primeira ocorrência em criação aninhada: status sempre `materialized` independente de `postingMode` (`RCREV-DEF-26`).
- [ ] `RCREV-S4-19` Testar limite de range em `occurrenceDate` no confirm — datas fora do range retornam 422 (`RCREV-DEF-25`).
- [ ] `RCREV-S4-20` Testar `sequence` em série com gaps: `skipped` ocupa posição (`RCREV-DEF-24`).
- [ ] `RCREV-S4-21` Testar sequência das 3 migrations (A → B → C) executando do zero e em snapshot de produção (`RCREV-DEF-29`).
- [ ] `RCREV-S4-22` Testar índice composto `(recurrence_id, status)` — `EXPLAIN ANALYZE` mostra index scan na query do badge (`RCREV-S2-02D`).
- [ ] `RCREV-S4-23` Testar mensagens de erro em PT-BR para 422/409 críticos (`RCREV-DEF-30`).
- [ ] `RCREV-S4-24` Testar gravação de `metadata.adjustments` quando confirm ajusta campos do `reviewPayload` (`RCREV-DEF-34`).

### Sprint E - Documentação / Entrega

- [ ] `RCREV-S5-01` Atualizar documentação técnica da API.
- [ ] `RCREV-S5-02` Atualizar documentação operacional do job.
- [ ] `RCREV-S5-03` Atualizar `docs-hidden/changes.md`.
- [ ] `RCREV-S5-04` Revisar plano e mover para `done/` quando concluído.

## Matriz de execução por etapa (obrigatória)

| Etapa | Objetivo | Arquivos-alvo | Risco | Dependências | O que testar (manual) | O que testar (automatizado) |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | Modelar contratos e dados | `opa-finance-api/src/db/schemas/recurrences.schema.ts`, migrations (3 separadas), índice em `recurrence_occurrences`, schemas de recorrência | alto | decisões `RCREV-DEF-*` | criar recorrência automática e com revisão | schema unit, migration sequencial, parse de payload |
| E2 | Gerar pendências | services de materialização e validators | alto | E1 | rodar materialização e ver pendência sem transação | integração materialize automatic/review |
| E3 | Confirmar/ignorar | novas rotas/services de ocorrência | alto | E2 | confirmar e ignorar pendência | integração confirm/skip + ownership |
| E4 | Timeline | service/route de timeline | médio | E1-E3 | abrir detalhe e conferir parcelas | unit de projeção + integração timeline |
| E5 | Forecast | recurrence forecast service | médio | E1-E4 | comparar real/projetado com pendências | integração forecast |
| E6 | Frontend detalhe | feature `recurrences` | médio | E4 | abrir modal, confirmar/ignorar | integração MSW |
| E7 | Fluxos de criação | features `transactions` e `transfers` | alto | E1-E3 | criar lançamento recorrente sem duplicar | unit mappers/hooks + integração |

## Checklist de testes por etapa (obrigatório)

### E1

- [ ] criar recorrência `automatic` válida.
- [ ] criar recorrência `review_required` válida.
- [ ] bloquear `postingMode` inválido.
- [ ] garantir default `automatic`.
- [ ] validar backfill de recorrências existentes para `automatic`.
- [ ] validar expansão segura dos status de ocorrência.
- [ ] validar criação de coluna `version` em `recurrence_occurrences` com default `1`.
- [ ] validar criação de coluna `reviewPayload` (`jsonb`) em `recurrence_occurrences`.
- [ ] migration de `ALTER TYPE ADD VALUE` separada da migration que usa os novos valores.
- [ ] sequência das 3 migrations (A/B/C) executa do zero sem erro (`RCREV-DEF-29`).
- [ ] sequência das 3 migrations executa em snapshot de produção sem erro.
- [ ] índice composto `(recurrence_id, status)` criado em `recurrence_occurrences` (`RCREV-S2-02D`).
- [ ] teste automatizado criado/ajustado.

### E2

- [ ] materialização `automatic` cria transação como hoje.
- [ ] materialização `review_required` cria `pending_review`.
- [ ] não criar transação ao gerar pendência.
- [ ] idempotência impede pendência duplicada (rodar job 2x na mesma janela).
- [ ] `nextOccurrenceDate` avança ao gerar pendência.
- [ ] `lastMaterializedDate` não é atualizado ao gerar pendência.
- [ ] `POST /recurrences/materialize` em `review_required` gera pendência, não transação.
- [ ] geração de pendências respeita `endOccurrences` — `by_occurrences=3` não gera mais que 3 pendências (`RCREV-CNF-10`).
- [ ] primeira ocorrência via criação aninhada (`POST /transactions`/`POST /transfers`) nasce `materialized` mesmo com `postingMode = review_required` (`RCREV-DEF-26`).
- [ ] teste automatizado criado/ajustado.

### E3

- [ ] confirmar pendência de transação.
- [ ] confirmar pendência de transferência.
- [ ] ignorar pendência.
- [ ] bloquear confirmação cross-user.
- [ ] bloquear confirmação de ocorrência já materializada/ignorada.
- [ ] dois confirms simultâneos: segundo recebe 409.
- [ ] confirm com `expectedVersion` desatualizado recebe 409.
- [ ] confirm de transferência com falha em uma perna faz rollback (nenhuma transação criada).
- [ ] auditoria registra confirm/skip/fail.
- [ ] confirm com `occurrenceDate` fora do range definido retorna 422 (`RCREV-DEF-25`).
- [ ] teste automatizado criado/ajustado.

### E4

- [ ] timeline exibe materializadas.
- [ ] timeline exibe pendentes.
- [ ] timeline exibe ignoradas.
- [ ] timeline projeta futuras.
- [ ] timeline respeita limite/horizonte.
- [ ] `sequence` em série com `skipped` ocupa posição (`skipped` na posição 3 → próxima pendência é "Parcela 4 de N") (`RCREV-DEF-24`).
- [ ] teste automatizado criado/ajustado.

### E5

- [ ] forecast não conta ignoradas como valor projetado.
- [ ] forecast conta pendências conforme decisão final.
- [ ] forecast não duplica materializadas.
- [ ] forecast não duplica pendências persistidas.
- [ ] forecast respeita filtro por conta em transferências.
- [ ] forecast com 3 pendências persistidas retorna 3 itens, não 6 (`RCREV-CNF-11`).
- [ ] forecast filtra pendências pela conta da regra-mãe, não pelo `reviewPayload` (`RCREV-DEF-28`).
- [ ] teste automatizado criado/ajustado.

### E6

- [ ] modal abre pela listagem.
- [ ] modal mostra resumo.
- [ ] tabela mostra status corretos.
- [ ] confirmar pendência atualiza tabela.
- [ ] ignorar pendência atualiza tabela.
- [ ] badge/contador de pendências aparece na linha da listagem (`RCREV-DEF-27`).
- [ ] mensagem de erro 422 aparece quando data ajustada está fora do range (`RCREV-DEF-25`).
- [ ] modal de confirmação abre com campos do `reviewPayload` pré-preenchidos e editáveis (`RCREV-DEF-31`).
- [ ] mensagens de erro vindas do backend aparecem em PT-BR (`RCREV-DEF-30`).
- [ ] teste automatizado criado/ajustado.

### E7

- [ ] nova transação recorrente usa criação aninhada.
- [ ] nova transferência recorrente usa criação aninhada.
- [ ] falha de recorrência não deixa rollback best-effort frágil no frontend.
- [ ] lançamento inicial fica vinculado à ocorrência quando aplicável (via `resolveSubmitOccurrence`).
- [ ] `GET /transactions` não retorna pendências.
- [ ] alteração de `postingMode` em recorrência ativa segue `RCREV-DEF-15`.
- [ ] finalização/exclusão de recorrência com pendências abertas segue `RCREV-DEF-16`.
- [ ] teste automatizado criado/ajustado.

## Plano de validação manual

1. Criar recorrência mensal automática e validar lançamento automático.
2. Criar recorrência mensal com revisão e validar geração de pendência.
3. Confirmar pendência de transação e validar lançamento criado.
4. Confirmar pendência de transferência e validar duas pernas criadas.
5. Ignorar pendência e validar consumo de parcela.
6. Criar compra parcelada de 10 parcelas e validar tabela no modal.
7. Editar regra com pendências existentes:
   - 7a. alterar `amount` da regra-mãe — pendência existente mantém o valor original (snapshot).
   - 7b. alterar `accountId` da regra-mãe — pendência existente mantém a conta original.
   - 7c. alterar `postingMode` (`automatic ↔ review_required`) conforme `RCREV-DEF-15`.
8. Validar forecast com lançadas, pendentes, ignoradas e previstas.
9. Validar bloqueio cross-user (confirm/skip/timeline com usuário não-dono retorna 404/403).
10. Tentar confirm em duas abas/duplo clique — segundo request recebe 409 com mensagem clara.
11. Tentar finalizar/excluir recorrência com pendência aberta — comportamento conforme `RCREV-DEF-16`.
12. Validar modal de detalhe e tabela de ocorrências em viewport mobile (<960px) — header, cards de resumo e tabela permanecem legíveis e usáveis.
13. Validar modal de confirmação de pendência (`ConfirmRecurrenceOccurrenceModal`) em mobile — campos editáveis e botões acessíveis.

## Comandos de validação

Backend:

```bash
cd opa-finance-api
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

Frontend:

```bash
cd opa-finance-front
npm run lint
npm run build
```

Testes direcionados sugeridos:

```bash
cd opa-finance-api
npx vitest run test/unit/recurrence-schedule-utils.unit.test.ts
npx vitest run test/integration/recurrences/recurrences-critical-rules.test.ts
npx vitest run test/integration/recurrences/recurrences-forecast.test.ts
```

```bash
cd opa-finance-front
npx vitest run test/unit/features/recurrences/model/recurrences.helpers.test.ts
npx vitest run test/integration/features/recurrences/recurrences.integration.test.tsx
```

## Riscos e mitigação

- Risco: quebrar comportamento automático atual.
  Mitigação: manter `postingMode = automatic` como default e cobrir regressão de materialização atual.

- Risco: gerar pendências duplicadas.
  Mitigação: manter índice idempotente por recorrência/data/origem.

- Risco: pendência mudar após edição da regra.
  Mitigação: snapshot da ocorrência no momento da geração.

- Risco: timeline infinita para recorrências sem fim.
  Mitigação: limite/horizonte obrigatório com default conservador.

- Risco: transferência confirmada parcialmente.
  Mitigação: confirmação dentro de transação de banco.

- Risco: frontend duplicar regra de negócio.
  Mitigação: frontend faz validação UX, mas backend permanece autoridade.

- Risco: fluxo atual de criação em duas chamadas criar inconsistência.
  Mitigação: migrar para criação aninhada em transações/transferências no escopo da melhoria.

- Risco: status `failed` consumir ou não consumir ocorrência de forma incoerente.
  Mitigação: fechar `RCREV-DEF-06` antes da implementação.

- Risco: forecast duplicar pendências.
  Mitigação: fechar `RCREV-DEF-07` e testar deduplicação de datas persistidas.

- Risco: snapshot de pendência misturar dado de negócio e metadata técnica.
  Mitigação: fechar `RCREV-DEF-08` e separar `reviewPayload` de `metadata`.

- Risco: contrato de timeline não informar janela parcial.
  Mitigação: fechar `RCREV-DEF-09` e expor metadados de limite na resposta.

- Risco: migration incompleta quebrar dados existentes.
  Mitigação: fechar `RCREV-DEF-14` e validar backfill/enum/status em testes.

- Risco: `ALTER TYPE ADD VALUE` no Postgres falhar por estar na mesma migration que usa o valor.
  Mitigação: separar em migrations distintas (`RCREV-CNF-08`).

- Risco: dois confirms simultâneos criarem duas transações para a mesma pendência.
  Mitigação: `expectedVersion` no payload + `UPDATE ... WHERE status = 'pending_review'` (`RCREV-CNF-06`).

- Risco: job re-tentar gerar pendência já existente.
  Mitigação: avançar `nextOccurrenceDate` ao gerar pendência e manter unique constraint (`RCREV-CNF-07`, `RCREV-DEF-21`).

- Risco: endpoint admin `POST /recurrences/materialize` bypass a revisão em modo `review_required`.
  Mitigação: serviço respeita `postingMode` (`RCREV-CNF-09`).

- Risco: pendência ficar órfã após finalizar/excluir recorrência.
  Mitigação: fechar `RCREV-DEF-16`.

- Risco: alterar `postingMode` em recorrência ativa criar estado inconsistente.
  Mitigação: fechar `RCREV-DEF-15`.

- Risco: `RCREV-CNF-10` — query de contagem em `recurrence-materialize.service.ts:231` filtra só `materialized` e gera pendências infinitamente em `review_required` com `by_occurrences`.
  Mitigação: sub-task explícita em `RCREV-S2-03` + teste `RCREV-S4-16`.

- Risco: `RCREV-CNF-11` — forecast duplica datas de pendências persistidas porque `materializedDateSet` e `materializedCountByRecurrence` filtram só `materialized`.
  Mitigação: sub-task explícita em `RCREV-S2-07` + teste `RCREV-S4-17`.

- Risco: `RCREV-CNF-12` — `failed` é terminal por causa do índice idempotente; sem retry, séries com falha transitória ficam presas.
  Mitigação: aceite consciente para o MVP, documentação operacional + alerta/métrica de `failed` por recorrência.

- Risco: primeira ocorrência via aninhado nascer como `pending_review` quando o usuário já confirmou o lançamento no submit.
  Mitigação: `RCREV-DEF-26` + sub-task `RCREV-S2-03C`.

- Risco: usuário ajustar `occurrenceDate` no confirm com data muito distante (ex.: 2030) por engano ou abuso.
  Mitigação: validação de range conforme `RCREV-DEF-25`.

- Risco: numeração de `sequence` ambígua em séries com `skipped` no meio (parcela 4 vira "Parcela 3" ou "Parcela 4"?).
  Mitigação: `RCREV-DEF-24` define explicitamente que `skipped` ocupa posição.

- Risco: drizzle-kit gerar `DROP TYPE / CREATE TYPE` para alterações de enum, perdendo dados em produção.
  Mitigação: SQL bruto manual para `ALTER TYPE ADD VALUE` + revisão obrigatória do SQL gerado antes de aplicar (`RCREV-DEF-29`).

- Risco: badge de pendências por linha causar table scan em `recurrence_occurrences` com volume.
  Mitigação: índice composto `(recurrence_id, status)` em `RCREV-S2-02D`.

- Risco: mensagens de erro em inglês para 4xx críticos confundirem o usuário final.
  Mitigação: `RCREV-DEF-30` define que backend retorna `detail` em PT-BR para erros de domínio.

- Risco: confirm sem ajuste forçar usuário a editar a transação depois (UX ruim) OU confirm com ajuste sem registro (auditoria ruim).
  Mitigação: `RCREV-DEF-31` (modal de edição) + `RCREV-DEF-34` (gravar ajustes em `metadata.adjustments`).

- Risco: pendências antigas acumulando indefinidamente (sem cleanup).
  Mitigação: aceite consciente para o MVP (`RCREV-DEF-33`); planejar cleanup em v2 com base em telemetria.

## Melhorias futuras (v2 e além)

Itens conscientemente fora do MVP, agrupados por tema. Cada bloco lista motivação, escopo proposto e gatilho que justifica priorização. Referências cruzadas com a definição/conflito que originou cada item.

### Notificações e lembretes ativos

Origem: `RCREV-DEF-35`.

- **Banner in-app na home** — alerta global "Você tem X pendências para revisar" ao abrir o app, com link direto para a primeira pendência aberta.
- **Campo `notifyDaysBefore`** na recorrência — gera pendência com antecedência configurável (ex.: 3 dias antes do vencimento) em vez de exatamente na data.
- **Distinção visual de urgência** no badge e na timeline — pendências "vencendo hoje", "vencidas há X dias" e "futuras" com cores e ordenação diferenciadas.
- **Push notification** (mobile/PWA) e **email** opcionais por usuário — exigem nova dependência externa (provider de email/push) e tela de preferências.

Gatilho para priorizar: usuários reportando que esquecem pagamentos, ou telemetria mostrando alta proporção de pendências confirmadas com atraso.

### Recuperação de erros (`failed`)

Origem: `RCREV-CNF-12`, `RCREV-DEF-06`, `RCREV-DEF-17`, `RCREV-DEF-32`.

- **Coluna `failedAttempts`** em `recurrence_occurrences` — contador de tentativas; permite estratégia de retry com backoff.
- **Cap configurável** de tentativas — após N falhas, marcar como `failed_terminal` que consome `by_occurrences` para destravar a série.
- **Rota `POST /recurrences/occurrences/:id/retry`** — reabre ocorrência `failed` como `pending_review` para reprocessamento manual; envolve `onConflictDoUpdate` no índice idempotente.
- **Métrica/alerta** de count de `failed` por recorrência — observabilidade para detectar séries presas.

Gatilho para priorizar: telemetria mostrando volume relevante de `failed` em produção, ou suporte recebendo pedidos manuais de "reprocessar pendência que falhou".

### Visibilidade global de pendências

Origem: `RCREV-DEF-27`.

- **Endpoint `GET /recurrences/occurrences/pending`** — lista achatada com filtros (data, valor, conta, recorrência), paginada.
- **Tela "Inbox de pendências"** — visualização global onde usuário trata todas as pendências de uma vez sem entrar em cada recorrência.
- **Ações em massa** — confirmar/skip de múltiplas pendências em uma única interação.

Gatilho para priorizar: telemetria mostrando usuários com >5 pendências abertas com frequência, ou feedback explícito pedindo visão consolidada.

### Recuperação de ações do usuário

Origem: `RCREV-DEF-03`, `RCREV-DEF-11`.

- **Reabertura de ocorrência ignorada** — rota `POST /recurrences/occurrences/:id/reopen` que volta `skipped` para `pending_review`.
- **Tratamento da contagem `by_occurrences`** ao reabrir — definir se a posição "devolve" ou se a série continua com a parcela duplicada.
- **Aviso no skip** — modal de confirmação destacando que skip consome `by_occurrences` e não pode ser desfeito no MVP atual.

Gatilho para priorizar: auditoria mostrando incidência alta de skips revertidos manualmente via SQL, ou suporte recebendo pedidos.

### Limpeza e manutenção automática

Origem: `RCREV-DEF-33`.

- **Job de cleanup de pendências antigas** — pendências `pending_review` com `>X dias` (ex.: 90) podem ser marcadas como expiradas (`expired`?) ou movidas para tabela de arquivamento.
- **Notificação ao usuário** antes de expirar pendência — UX para evitar perda silenciosa.
- **Política configurável** por usuário (manter para sempre vs expirar após X dias).

Gatilho para priorizar: telemetria mostrando acúmulo de pendências antigas (>90 dias sem ação) ou impacto em performance de queries.

### Navegação e UX avançada

Origem: `RCREV-DEF-13`.

- **Página dedicada `/app/recurrences/:id`** com deep-link — substitui ou complementa o modal de detalhe; melhora compartilhamento e responsividade mobile.
- **Drawer lateral** como alternativa ao modal — mantém contexto de navegação visível.
- **Filtro por status na timeline** — usuário pode ver apenas pendências, ou apenas materializadas.

Gatilho para priorizar: feedback de usuários usando muito a tela de detalhe e perdendo contexto, ou demanda por compartilhar link de recorrência.

### Modelo de domínio expandido

Itens que dependem de novas decisões de produto antes de entrar em escopo:

- **Modo `notify_only`** — terceiro `postingMode` que apenas notifica (não cria pendência nem transação). Útil para "lembretes não-financeiros". Origem: alternativa em `RCREV-DEF-10`.
- **Entidade `Installment`** separada de `Recurrence` — modelagem dedicada para parcelamento, separada de "recorrência genérica". Origem: alternativa em `RCREV-DEF-12`.
- **Histórico de versões da regra-mãe** — registro completo de cada alteração da `Recurrence` para reconstrução temporal. Hoje `RCREV-DEF-04` resolve via snapshot na pendência; histórico completo seria mais robusto.

Gatilho para priorizar: necessidade explícita de produto, não cobertura suficiente do MVP.

### Telemetria e observabilidade

Itens não bloqueantes mas que aceleram decisões futuras:

- **Métricas por modo** — `automatic` vs `review_required` (volume de uso, tempo médio até confirm, taxa de skip).
- **Métricas de UX** — taxa de ajuste no confirm (campos alterados em `metadata.adjustments`), distribuição de delay entre `originalScheduledDate` e `occurrenceDate` confirmada.
- **Métricas de sistema** — duração do job, count de retries, latência da timeline.

Gatilho para priorizar: junto com qualquer item acima — métricas guiam priorização do que vale a pena evoluir.
