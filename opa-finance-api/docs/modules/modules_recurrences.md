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
- Materialização usa chave idempotente para evitar duplicidade
- `failed` é estado terminal no MVP; não há retry automático nem reabertura por fluxo padrão
- `review_required` gera `pending_review` no job e não materializa diretamente a transação/transferência
- `pending_review` e `skipped` contam como ocorrência consumida em `by_occurrences`
- Transferência recorrente é materializada de forma atômica (duas transações com rollback integral em falha)
- Cálculo de calendário considera timezone do usuário/regra

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
- `POST /recurrences/materialize`
- `GET /recurrences/:id/timeline`
- `GET /recurrences/forecast`
