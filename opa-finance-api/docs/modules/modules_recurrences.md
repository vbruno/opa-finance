# Módulo: Recurrences

## Responsabilidades

- CRUD de regras de recorrência para transações e transferências
- Edição por escopo (`single`, `this_and_next`, `all`)
- Finalização e exclusão lógica de regras
- Materialização sob demanda de ocorrências pendentes
- Confirmação e ignorar pendências de revisão
- Timeline de recorrência com ocorrências persistidas e projetadas
- Overrides pontuais de ocorrências projetadas
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
- Bloqueio estrutural da regra-mãe: após existir qualquer ocorrência `materialized`, `pending_review`, `skipped` ou `failed`, a edição global (`PUT /recurrences/:id` ou `edit-scope` com `scope = all`) passa a aceitar apenas `description` e `notes`
- Decisão conservadora: `failed` também conta para o bloqueio estrutural, porque já houve tentativa de execução da regra
- Após o bloqueio estrutural, alterações futuras de valor, agenda, conta, categoria e demais campos estruturais devem usar `this_and_next`, que encerra a regra atual na véspera e cria uma nova regra a partir da ocorrência-alvo
- `amount` também fica bloqueado na edição global pós-consumo; mudanças futuras de valor devem seguir por override pontual (`projected`) ou `this_and_next`
- Transferência recorrente é materializada de forma atômica (duas transações com rollback integral em falha)
- Cálculo de calendário considera timezone do usuário/regra
- Recorrências com término `never` têm horizonte operacional máximo de 1 ano a partir de `startDate` para timeline, antecipação e materialização
- Materialização de `never` limita `untilDate` ao horizonte operacional e finaliza a regra ao ultrapassar esse horizonte se não houver `pending_review` aberta
- Recorrências com término `until_date` são finitas: timeline e paginação contam somente ocorrências até `endDate` e exibem sequência/total da série
- Timeline expõe `version` e `reviewPayload` para itens persistidos, permitindo confirm/skip com lock otimista e pré-preenchimento do modal no frontend
- Para ocorrências `materialized` com `transactionId`, o `amount` exibido na timeline é sempre o valor atual da tabela `transactions` (não o `reviewPayload`), refletindo edições feitas após a materialização; para transferências (`transferId != null`), o comportamento é mantido via `reviewPayload`
- Antecipação (`POST /recurrences/:id/anticipate`): permite materializar imediatamente uma ocorrência projetada (ainda não persistida); valida que a data é válida na série, que não existe duplicata e que o limite `by_occurrences` não foi atingido; insere a ocorrência e cria a transação/transferência na mesma transação de banco
- A listagem `GET /recurrences` inclui `pendingReviewCount` por recorrência para suportar o badge de pendências na UI
- `GET /recurrences`, `GET /recurrences/:id` e `GET /recurrences/:id/timeline` expõem `hasConsumedOccurrences: boolean` para a UI distinguir regras ainda totalmente editáveis de regras estruturalmente bloqueadas
- Overrides pontuais (`recurrence_occurrence_overrides`) permitem ajustar apenas `amount`, `description` e `notes` de uma ocorrência `projected`; campos `NULL` herdam o valor da regra-mãe
- Overrides só podem ser criados para datas futuras válidas da série e sem ocorrência persistida (`materialized`, `pending_review`, `skipped` ou `failed`)
- `edit-scope` com `scope = single` em data sem ocorrência persistida retorna `422`; o cliente deve usar `PUT /recurrences/:id/occurrences/override` para ajuste pontual de ocorrência projetada
- Em `this_and_next`, quando a regra original preserva `endType = by_occurrences` sem novo `endOccurrences` explícito, a nova regra recebe apenas as ocorrências restantes, descontando `materialized + pending_review + skipped` já consumidas na regra original
- A timeline retorna `hasOverride` e mescla o `amount` em itens projetados; itens persistidos não são afetados por overrides
- A materialização consome o override dentro da mesma transação e remove o registro após criar a ocorrência
- `this_and_next` migra overrides futuros para a nova regra criada; `skip` remove override da mesma data quando existir

## Endpoints

- `POST /recurrences`
- `GET /recurrences`
- `GET /recurrences/:id`
- `PUT /recurrences/:id`
- `PUT /recurrences/:id/edit-scope`
- `PUT /recurrences/:id/occurrences/override`
- `DELETE /recurrences/:id/occurrences/override/:date`
- `PUT /recurrences/:id/finalize`
- `DELETE /recurrences/:id`
- `POST /recurrences/occurrences/:id/confirm`
- `POST /recurrences/occurrences/:id/skip`
- `POST /recurrences/:id/anticipate`
- `POST /recurrences/materialize`
- `GET /recurrences/:id/timeline`
- `GET /recurrences/forecast`

### Overrides de ocorrência projetada

`PUT /recurrences/:id/occurrences/override`

Body:

```json
{
  "occurrenceDate": "2030-01-14",
  "amount": 250,
  "description": "Descrição pontual",
  "notes": "Observação pontual"
}
```

Regras:

- `occurrenceDate` deve estar em `YYYY-MM-DD`
- pelo menos um campo entre `amount`, `description` e `notes` deve ser informado
- `amount`, quando informado, deve ser maior que zero
- `description`/`notes` com `null` fazem a ocorrência herdar o valor da regra
- retorna `404` se a recorrência não pertence ao usuário autenticado
- retorna `422` para data passada, data fora da série, data fora do término/horizonte operacional ou data já persistida em `recurrence_occurrences`

Response `200`:

```json
{
  "id": "uuid",
  "recurrenceId": "uuid",
  "userId": "uuid",
  "occurrenceDate": "2030-01-14",
  "amount": 250,
  "description": "Descrição pontual",
  "notes": "Observação pontual",
  "createdAt": "2030-01-01T00:00:00.000Z",
  "updatedAt": "2030-01-01T00:00:00.000Z"
}
```

`DELETE /recurrences/:id/occurrences/override/:date`

- remove o override pontual da data
- retorna `204` sem body
- retorna `404` se a recorrência ou o override não existir para o usuário
