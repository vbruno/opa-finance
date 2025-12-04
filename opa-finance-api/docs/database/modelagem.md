
# Modelagem do Banco (Atualizada 2025)

## USERS
- id, name, email, password_hash, timestamps  

## ACCOUNTS
- id  
- user_id  
- name  
- type ("cash", "checking_account", "savings_account", "credit_card", "investment")  
- initial_balance  
- color  
- icon  
- timestamps  

## CATEGORIES
- id  
- user_id  
- name  
- type ("income" | "expense")  
- color  
- timestamps  

## SUBCATEGORIES
- id  
- user_id  
- category_id  
- name  
- color  
- timestamps  

## TRANSACTIONS
- id  
- user_id  
- account_id  
- category_id  
- subcategory_id (opcional)  
- type  
- amount  
- description  
- date  
- timestamps  

## Relacionamentos
- users 1:N accounts  
- users 1:N categories  
- users 1:N subcategories  
- users 1:N transactions  
- categories 1:N subcategories  
- categories 1:N transactions  
- subcategories 1:N transactions  
- accounts 1:N transactions  
