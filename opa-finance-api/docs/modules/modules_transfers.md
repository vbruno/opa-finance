# Módulo: Transfers

## Responsabilidades
- Criar transferências entre contas
- Validar acesso às contas
- Garantir atomicidade das operações

## Regras
- Conta de origem e destino devem ser diferentes
- Ambas as contas devem pertencer ao usuário autenticado
- Utiliza categoria de sistema "Transferência" (userId null, system true)
- Gera duas transações vinculadas por `transferId`:
  - Débito (expense) na conta de origem
  - Crédito (income) na conta de destino
- Operação atômica (transação de banco de dados)
- Valor deve ser maior que zero
- Data no formato YYYY-MM-DD

## Campos
- fromAccountId (UUID): Conta de origem
- toAccountId (UUID): Conta de destino
- amount (number): Valor da transferência (deve ser positivo)
- date (string): Data da transferência (formato YYYY-MM-DD)
- description (string, opcional): Descrição da transferência

## Endpoints
POST /transfers

## Resposta
Retorna objeto com:
- id: transferId único (UUID) que vincula as duas transações
- fromAccount: Transação de débito criada na conta de origem
- toAccount: Transação de crédito criada na conta de destino

