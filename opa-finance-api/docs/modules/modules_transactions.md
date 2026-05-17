# Módulo: Transactions

## Responsabilidades

- Criar transações
- Editar transações
- Excluir transações
- Listar transações por filtros
- Resumo de transações (summary)
- Top 5 categorias de gasto
- Fluxo de caixa agregado por dia/semana/mês (cashflow)
- Distribuição completa por categoria com cores (category-breakdown)

## Regras

- category_id obrigatório
- subcategory_id opcional
- mudar categoria → limpa subcategoria
- valores entram no saldo da conta
- transfer_id opcional: vincula transações de transferências (duas transações com mesmo transferId)
- excluir transação com transfer_id remove as duas transações da transferência

## Campos

- amount, type, date, description, notes, transfer_id (opcional)

## Filtros de listagem

- startDate, endDate, accountId, categoryId, subcategoryId, type, description, notes
  - Observação: busca por description/notes é insensível a acento com extensão `unaccent` habilitada.

## Top gastos (categorias/subcategorias)

- Agregado por `category` (default) ou `subcategory`
- Filtros: startDate, endDate, accountId
- Sempre considera apenas despesas (type = expense)
- Retorno: id, name, totalAmount, percentage (opcional)
- Se `groupBy=subcategory`, retorna também categoryId/categoryName

## Fluxo de caixa (cashflow)

- Série temporal com `income` e `expense` agregados por bucket
- `granularity`: `day`, `week` (segunda-feira como início) ou `month` (dia 1)
- Filtros: startDate (obrig.), endDate (obrig.), accountId, excludeHiddenAccounts
- Buckets sem transações são preenchidos com 0 — série sempre contínua

## Distribuição por categoria (category-breakdown)

- Todas as categorias com transações no período (sem limite de 5)
- Inclui `color` da categoria (pode ser `null`)
- `percentage` calculado sobre o total do período
- Filtros: startDate (obrig.), endDate (obrig.), accountId, type (default: expense), excludeHiddenAccounts

## Autocomplete de descrições

- Endpoint para retornar descrições únicas usadas pelo usuário
- Filtros: accountId (obrigatório), q (opcional), limit (default 5, max 20)
- Distinct case-insensitive e ordenado pela criação mais recente
