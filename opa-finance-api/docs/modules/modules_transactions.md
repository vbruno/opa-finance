
# Módulo: Transactions

## Responsabilidades
- Criar transações
- Editar transações
- Excluir transações
- Listar transações por filtros
- Resumo de transações (summary)

## Regras
- category_id obrigatório
- subcategory_id opcional
- mudar categoria → limpa subcategoria
- valores entram no saldo da conta
- transfer_id opcional: vincula transações de transferências (duas transações com mesmo transferId)

## Campos
- amount, type, date, description, transfer_id (opcional)
