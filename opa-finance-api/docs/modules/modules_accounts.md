
# Módulo: Accounts

## Responsabilidades
- Criar contas
- Editar contas
- Listar contas
- Definir conta principal

## Regras
- Saldo calculado automaticamente
- Não excluir conta com transações
- Não excluir conta principal (marcar outra como principal antes)
- Tipos suportados: cash, checking_account, savings_account, credit_card, investment
- Cada usuário pode ter no máximo uma conta principal (isPrimary)
- A primeira conta criada é marcada como principal automaticamente
- Deve existir sempre uma conta principal enquanto houver contas

## Campos
- name, type, initial_balance, color, icon, isPrimary
