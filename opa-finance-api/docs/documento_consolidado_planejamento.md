# 📘 Documento Consolidado — Planejamento Completo do Sistema de Controle Financeiro

Este documento consolida a **visão macro**, **decisões técnicas**, **regras de negócio**, **modelagem atualizada** e **roadmap** do projeto **OPA Finance**.  
Ele deve ser usado como **fonte única de verdade** para backend e frontend.

---

## 🧭 1. Visão Macro do Projeto

### 🎯 Objetivo

Permitir que o usuário tenha **clareza total sobre sua vida financeira**, identificando padrões de gasto, oportunidades de economia e evolução mensal do patrimônio.

### 👥 Público-Alvo

- Uso pessoal
- Pessoas que desejam organizar, controlar e reduzir gastos
- Usuários iniciantes em controle financeiro

### 🧩 Problemas Resolvidos

1. Falta de visibilidade dos gastos
2. Dificuldade de controlar o mês
3. Gastar mais do que ganha sem perceber
4. Falta de clareza por categoria
5. Desorganização financeira
6. Histórico difícil de analisar
7. Comparação entre meses inexistente
8. Falta de visão de saldo real por conta

---

## 🚀 2. MVP — Funcionalidades Principais

### Autenticação

- Login
- Registro
- Logout
- JWT (access token)

### Estrutura Financeira

- Contas (cash, checking, savings, credit card, investment)
- Categorias
  - Categorias **de sistema**
  - Categorias **do usuário**
- Subcategorias (opcionais)

### Transações

- Income / Expense
- Filtros:
  - Período (startDate / endDate)
  - Conta
  - Categoria
  - Subcategoria
  - Tipo
- Paginação
- Validações de regra de negócio

### Transferências

- Transferência entre contas
- Implementada como **duas transações** (débito na origem, crédito no destino)
- Utiliza **Categoria de Sistema: Transferência** (userId null, system true)
- Ligadas por `transferId` (UUID único)
- Validações:
  - Contas devem ser diferentes
  - Ambas as contas devem pertencer ao usuário
  - Valor deve ser positivo
  - Data no formato YYYY-MM-DD
- Operação atômica (transação de banco de dados)

### Dashboard (MVP)

- Total de receitas
- Total de despesas
- Saldo
- Resumo mensal

---

## 🏛 3. Visão Técnica do Sistema

### Frontend

- Vite + React + TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS
- shadcn/ui
- Zod
- Axios

### Backend

- Fastify + TypeScript
- Drizzle ORM
- PostgreSQL
- Zod (schemas)
- JWT
- Arquitetura modular por domínio

### Infraestrutura

- Docker
- Portainer
- Nginx (proxy reverso)
- Certbot (HTTPS)
- VPS (Hostinger)

---

## 🧱 4. Modelagem do Banco de Dados (Atualizada)

### USERS

- id
- name
- email
- password_hash
- created_at

### ACCOUNTS

- id
- user_id
- name
- type
- initial_balance
- color
- icon
- created_at
- updated_at

**Regras**

- Pertence a um usuário
- Não pode ser removida se houver transações

### CATEGORIES

- id
- user_id (nullable para sistema)
- name
- type (income | expense)
- color
- system (boolean)
- created_at
- updated_at

**Regras**

- Categorias de sistema são globais
- Categorias de sistema não podem ser alteradas ou removidas
- Usuários não podem criar categorias com o mesmo nome de categorias de sistema

### SUBCATEGORIES

- id
- user_id
- category_id
- name
- color
- created_at
- updated_at

**Regras**

- Sempre pertencem a uma categoria
- Herdam o tipo da categoria
- Opcionais na transação

### TRANSACTIONS

- id
- user_id
- account_id
- category_id
- subcategory_id (opcional)
- type (income | expense)
- amount
- date
- description
- transfer_id (opcional)
- created_at

**Regras**

- `category_id` é obrigatório
- `subcategory_id` opcional
- Transferências geram duas transações

---

## 🔗 5. Relacionamentos

- users 1:N accounts
- users 1:N categories
- users 1:N subcategories
- users 1:N transactions
- categories 1:N subcategories
- categories 1:N transactions
- accounts 1:N transactions

---

## 🧪 6. Testes

### Backend

- Vitest
- fastify.inject
- Testes de integração por módulo
- Banco PostgreSQL de teste (remoto)

### Cobertura

- Regras de negócio
- Validações
- Segurança (JWT)
- Filtros e paginação
- Transferências entre contas

---

## 📚 7. Documentação

- README técnico
- Documentação de regras de negócio
- OpenAPI / Swagger (planejado)
- Diagramas (ERD)

---

## 🗺 8. Roadmap

### Curto Prazo

1. ~~Finalizar módulo de Transferências~~ ✅
2. Ajustar categorias de sistema
3. Consolidar testes
4. Swagger

### Médio Prazo

5. Dashboard
6. Relatórios
7. Frontend MVP

### Longo Prazo

8. Comparativos mensais
9. Exportação de dados
10. Mobile (futuro)

---

## ✔ Documento Consolidado Atualizado

Este documento reflete o **estado atual real do backend** e está pronto para:

- Ser anexado ao repositório
- Guiar o desenvolvimento do frontend
- Servir como documentação oficial do projeto
