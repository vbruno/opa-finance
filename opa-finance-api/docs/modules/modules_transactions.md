
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
