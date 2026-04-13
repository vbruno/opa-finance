# Convenção de Testes Frontend

Este diretório define o padrão oficial de execução e escrita de testes do frontend.

## Como rodar os testes

- Rodar tudo (unit + integration):
  - `npm test`
- Rodar apenas unit:
  - `npm run test:unit`
- Rodar apenas integration:
  - `npm run test:integration`
- Rodar um arquivo específico:
  - `npx vitest run test/integration/features/transactions/transactions.list.integration.test.tsx`
- Rodar por diretório/bloco:
  - `npx vitest run test/unit/features/transactions`

## Estrutura de pastas

- `test/setup`
  - Infra comum dos testes (`setupTests`, `msw`, `render helpers`).
- `test/unit`
  - Testes unitários isolados, sem fluxo de tela completo.
- `test/integration`
  - Testes de integração da feature (com providers reais e `msw`).

## Co-location por feature

Dentro de `unit` e `integration`, os testes seguem o domínio da feature:

- `test/unit/features/<feature>/...`
- `test/integration/features/<feature>/...`

Exemplo em `transactions`:

- `test/unit/features/transactions/model/...`
- `test/unit/features/transactions/mappers/...`
- `test/unit/features/transactions/hooks/...`
- `test/integration/features/transactions/...`

## Padrão de nomes de arquivo

### Unit

- `<subject>.test.ts`
- `<subject>.test.tsx` (quando houver render de componente)

Exemplos:

- `transactions.helpers.test.ts`
- `transaction-payload.mapper.test.ts`
- `use-transactions-filters.test.ts`

### Integration

- `<feature>.<scenario>.integration.test.tsx`

Exemplos:

- `transactions.list.integration.test.tsx`
- `transactions.create-edit.integration.test.tsx`

## Regras de escopo

- Unit:
  - validar funções puras, hooks e mapeamentos.
  - evitar dependência de router/app shell completo.
- Integration:
  - validar fluxo funcional de UI (listagem, create/edit, etc.).
  - usar `renderRouteWithProviders` e `msw` para API.

## Infra de teste

- Setup global:
  - `test/setup/setupTests.ts`
- Servidor MSW:
  - `test/setup/msw.server.ts`
- Handlers base:
  - `test/setup/msw.handlers.ts`
- Helpers de resposta:
  - `test/setup/msw.utils.ts`
- Render helpers:
  - `test/setup/render.tsx`

Observações:

- `msw` está em modo estrito (`onUnhandledRequest: 'error'`), então toda chamada HTTP do teste precisa de handler.
- `scrollIntoView` está polyfilled no setup para compatibilidade com componentes Radix no `jsdom`.

## Sincronização e flakiness

- Preferir `findBy*` / `findAllBy*` para estados assíncronos de UI.
- Usar `waitForElementToBeRemoved` para fechamento de modal/spinner.
- Usar `waitFor` somente quando não houver query assíncrona adequada.
- Evitar assert por texto global quando houver duplicidade; usar escopo/queries específicas.

## Como escrever testes unitários

Checklist:

1. Criar arquivo em `test/unit/features/<feature>/<subdominio>/`.
2. Nomear com `<subject>.test.ts` (ou `.test.tsx` quando necessário).
3. Testar comportamento, não implementação interna.
4. Manter dados de teste pequenos e explícitos.

Exemplo (unit):

```ts
import { describe, expect, it } from 'vitest'
import { parseAmountFilter } from '@/features/transactions'

describe('parseAmountFilter', () => {
  it('deve interpretar valor exato', () => {
    expect(parseAmountFilter('123,45')).toEqual({ amount: 123.45 })
  })
})
```

## Como escrever testes de integração

Checklist:

1. Criar arquivo em `test/integration/features/<feature>/`.
2. Nomear com `<feature>.<scenario>.integration.test.tsx`.
3. Usar `renderRouteWithProviders` para renderizar rota real.
4. Declarar handlers `msw` do cenário (`GET/POST/PUT/DELETE` necessários).
5. Validar fluxo do usuário + efeito visível em tela.

Exemplo base (integration):

```tsx
import { http } from 'msw'
import { describe, it } from 'vitest'
import { renderRouteWithProviders, screen } from '../../../setup/render'
import { ok, server } from '../../../setup/msw'

describe('transactions list', () => {
  it('deve renderizar itens vindos da API mockada', async () => {
    server.use(http.get('*/transactions', () => ok({ data: [], page: 1, limit: 30, total: 0 })))
    renderRouteWithProviders({ initialEntries: ['/app/transactions'] })
    await screen.findByRole('heading', { name: 'Transações' })
  })
})
```

## Critério mínimo antes de abrir PR

1. `npm run lint` verde.
2. `npm run build` verde.
3. `npm run test:unit` verde.
4. `npm run test:integration` verde.
5. Sem uso desnecessário de `waitFor`.
