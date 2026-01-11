
# Módulo: Transactions

## Responsabilidades
- Criar transações
- Editar transações
- Excluir transações
- Listar transações por filtros
- Resumo de transações (summary)
- Top 5 categorias de gasto

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

## Autocomplete de descrições
- Endpoint para retornar descrições únicas usadas pelo usuário
- Filtros: accountId (obrigatório), q (opcional), limit (default 5, max 20)
- Distinct case-insensitive e ordenado pela criação mais recente
