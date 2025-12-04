# 📘 Documento Consolidado --- Planejamento Completo do Sistema de Controle Financeiro

Este documento reúne toda a visão **macro**, **técnica**, **regras de
negócio**, **modelagem** e **roadmap** do projeto.

------------------------------------------------------------------------

## 🧭 1. Visão Macro do Projeto

### 🎯 Objetivo

Permitir que o usuário visualize onde está gastando, identificando
oportunidades de reduzir despesas.

### 👥 Público-Alvo

-   Uso pessoal
-   Pessoas que desejam organizar e reduzir gastos

### 🧩 Problemas Resolvidos

1.  Falta de visibilidade dos gastos\
2.  Dificuldade de controlar o mês\
3.  Gastar mais do que ganha sem perceber\
4.  Falta de clareza por categoria\
5.  Desorganização financeira\
6.  Histórico difícil de analisar\
7.  Comparação entre meses inexistente

### 🚀 MVP --- Funcionalidades Principais

-   Login, Registro, Logout\
-   Categorias personalizadas\
-   Subcategorias opcionais\
-   Contas (wallet, bank, savings, etc.)\
-   Transações com filtros\
-   Dashboard básico\
-   Paginação de transações

### 🔄 Fluxo do Usuário

1.  Login\
2.  Dashboard\
3.  Criar categoria\
4.  Criar conta\
5.  Registrar transações\
6.  Acompanhamento mensal

------------------------------------------------------------------------

## 🏛 2. Visão Técnica do Sistema

### Frontend

-   **Vite + React + TS**
-   **TanStack Router**
-   **React Query**
-   **Tailwind + shadcn/ui**
-   **Axios + Zod**

### Backend

-   **Fastify + TypeScript**
-   **Drizzle ORM**
-   **PostgreSQL**
-   **JWT (access + refresh)**
-   **Zod**

### Infraestrutura

-   Docker + Portainer\
-   Nginx (proxy reverso)\
-   Certbot (HTTPS)\
-   VPS Hostinger

------------------------------------------------------------------------

## 🧱 3. Modelagem do Banco (Atualizada 2025)

### USERS

    id, name, email, password_hash, timestamps

### ACCOUNTS

    id, user_id, name,
    type ("cash", "checking_account", "savings_account", "credit_card", "investment"),
    initial_balance, color, icon, timestamps

Regras: - Saldo é calculado automaticamente\
- Não pode excluir se houver transações

### CATEGORIES

    id, user_id, name, type ("income" | "expense"), color, timestamps

Regras: - Obrigatória na transação\
- Personalizada por usuário\
- Não excluir se usada

### SUBCATEGORIES *(Nova entidade)*

    id, user_id, category_id, name, color, timestamps

Regras: - Herda tipo da categoria (não editável)\
- Opcional na transação\
- Pode repetir nome em categorias diferentes\
- Só excluir se não usada

### TRANSACTIONS

    id, user_id, account_id, category_id,
    subcategory_id (opcional),
    type ("income" | "expense"),
    amount, description, date, timestamps

Regras: - category_id obrigatório\
- subcategory_id opcional\
- mudar categoria remove subcategoria

------------------------------------------------------------------------

## 🔗 4. Relacionamentos

    users 1:N accounts  
    users 1:N categories  
    users 1:N subcategories  
    users 1:N transactions  
    categories 1:N subcategories  
    categories 1:N transactions  
    subcategories 1:N transactions  
    accounts 1:N transactions

------------------------------------------------------------------------

## 🧪 5. Testes do Backend

### Ferramentas:

-   Vitest\
-   fastify.inject\
-   SQLite para testes

### Tipos de Testes

-   Unitários (services, regras)\
-   Integração (rotas)\
-   Banco (migrations + queries)\
-   Segurança (JWT, refresh, rotas privadas)

------------------------------------------------------------------------

## 📚 6. Documentação

### Backend:

-   Swagger/OpenAPI\
-   Documentação de módulos\
-   Documentação de banco\
-   README técnico

------------------------------------------------------------------------

## 🗺 7. Roadmap Resumido

1.  Backend base + autenticação\
2.  Módulos principais (accounts, categories, subcategories,
    transactions)\
3.  Dashboard\
4.  Testes\
5.  Documentação\
6.  Frontend base\
7.  MVP completo\
8.  Deploy na VPS\
9.  Relatórios e melhorias pós-MVP

------------------------------------------------------------------------

## ✔ Documento Consolidado Finalizado

Pronto para anexar ao repositório e guiar o desenvolvimento completo do
projeto.
