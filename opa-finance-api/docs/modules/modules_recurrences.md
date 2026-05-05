# Módulo: Recurrences

## Responsabilidades

- CRUD de regras de recorrência para transações e transferências
- Edição por escopo (`single`, `this_and_next`, `all`)
- Finalização e exclusão lógica de regras
- Materialização sob demanda de ocorrências pendentes
- Confirmação e ignorar pendências de revisão
- Timeline de recorrência com ocorrências persistidas e projetadas
- Forecast de recorrências (real x projetado)
- Job diário de materialização com lock, retry e idempotência

## Regras

- Todas as rotas exigem autenticação e ownership
- Tipos suportados: `transaction` e `transfer`
- Modos de lançamento: `automatic` e `review_required`
- Status canônico: `active` e `finalized`
- Status de ocorrência: `materialized`, `pending_review`, `skipped` e `failed`
- Regra `active` não pode ser excluída; deve ser finalizada antes
- Edição concorrente usa controle otimista e pode retornar `409`
- Update parcial de recorrência não aplica defaults de criação; campos omitidos preservam o valor atual da regra
- Mudança de término normaliza campos incompatíveis: `never` limpa data/quantidade, `by_occurrences` limpa `endDate` e `until_date` limpa `endOccurrences`
- Edição por escopo no frontend usa snapshot por escopo: `all` com regra completa, `this_and_next` com nova regra sem `startDate`, `single` apenas com campos de negócio da ocorrência
- Materialização usa chave idempotente para evitar duplicidade
- `failed` é estado terminal no MVP; não há retry automático nem reabertura por fluxo padrão
- `review_required` gera `pending_review` no job e não materializa diretamente a transação/transferência
- `pending_review` e `skipped` contam como ocorrência consumida em `by_occurrences`
- Transferência recorrente é materializada de forma atômica (duas transações com rollback integral em falha)
- Cálculo de calendário considera timezone do usuário/regra
- Recorrências com término `never` têm horizonte operacional máximo de 1 ano a partir de `startDate` para timeline, antecipação e materialização
- Materialização de `never` limita `untilDate` ao horizonte operacional e finaliza a regra ao ultrapassar esse horizonte se não houver `pending_review` aberta
- Recorrências com término `until_date` são finitas: timeline e paginação contam somente ocorrências até `endDate` e exibem sequência/total da série
- Timeline expõe `version` e `reviewPayload` para itens persistidos, permitindo confirm/skip com lock otimista e pré-preenchimento do modal no frontend
- Para ocorrências `materialized` com `transactionId`, o `amount` exibido na timeline é sempre o valor atual da tabela `transactions` (não o `reviewPayload`), refletindo edições feitas após a materialização; para transferências (`transferId != null`), o comportamento é mantido via `reviewPayload`
- Antecipação (`POST /recurrences/:id/anticipate`): permite materializar imediatamente uma ocorrência projetada (ainda não persistida); valida que a data é válida na série, que não existe duplicata e que o limite `by_occurrences` não foi atingido; insere a ocorrência e cria a transação/transferência na mesma transação de banco
- A listagem `GET /recurrences` inclui `pendingReviewCount` por recorrência para suportar o badge de pendências na UI

## Endpoints

- `POST /recurrences`
- `GET /recurrences`
- `GET /recurrences/:id`
- `PUT /recurrences/:id`
- `PUT /recurrences/:id/edit-scope`
- `PUT /recurrences/:id/finalize`
- `DELETE /recurrences/:id`
- `POST /recurrences/occurrences/:id/confirm`
- `POST /recurrences/occurrences/:id/skip`
- `POST /recurrences/:id/anticipate`
- `POST /recurrences/materialize`
- `GET /recurrences/:id/timeline`
- `GET /recurrences/forecast`
