# Módulo: Recurrences

## Responsabilidades

- CRUD de regras de recorrência para transações e transferências
- Edição por escopo (`single`, `this_and_next`, `all`)
- Finalização e exclusão lógica de regras
- Materialização sob demanda de ocorrências pendentes
- Forecast de recorrências (real x projetado)
- Job diário de materialização com lock, retry e idempotência

## Regras

- Todas as rotas exigem autenticação e ownership
- Tipos suportados: `transaction` e `transfer`
- Status canônico: `active` e `finalized`
- Regra `active` não pode ser excluída; deve ser finalizada antes
- Edição concorrente usa controle otimista e pode retornar `409`
- Materialização usa chave idempotente para evitar duplicidade
- `failed` é estado terminal no MVP; não há retry automático nem reabertura por fluxo padrão
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
- `POST /recurrences/materialize`
- `GET /recurrences/forecast`
