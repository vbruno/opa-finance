# 🎨 Frontend — Sistema de Controle Financeiro

Guia vivo do desenvolvimento do **frontend** do projeto **opa-finance-front**.

Este documento deve ser atualizado ao longo do desenvolvimento para manter
decisões técnicas, arquitetura e progresso sempre alinhados.

---

## 📌 Definições do Projeto

- **Nome do projeto:** opa-finance-front
- **Framework:** React
- **Variant:** TypeScript + SWC
- **Bundler:** rolldown-vite (experimental)
- **Package manager:** npm
- **Ferramenta de build:** Vite

---

## 🎯 Objetivo do Frontend

Fornecer uma interface:

- Clara e simples para o usuário
- Alinhada às regras de negócio do backend
- Escalável para futuras funcionalidades
- Tipada e validada ponta a ponta

---

## 🧱 Stack Tecnológica

### Base

- Vite
- React
- TypeScript (SWC)

### Estilo

- Tailwind CSS **v4.1**
  - Configuração **CSS-first**
  - Plugin: `@tailwindcss/vite`
  - Arquivo global: `src/index.css`
  - Importação:

    ```css
    @import "tailwindcss";
    ```

### Roteamento & Estado

- TanStack Router
- TanStack Query (React Query)

### UI

- shadcn/ui (integrado com Tailwind v4.1)

### Comunicação & Validação

- Axios
- Zod

---

## 🗂️ Arquitetura de Pastas

```txt
src/
├─ app/
├─ features/
│  ├─ auth/
│  ├─ dashboard/
│  ├─ accounts/
│  ├─ categories/
│  ├─ subcategories/
│  └─ transactions/
├─ components/
├─ services/
├─ schemas/
├─ types/
├─ hooks/
├─ lib/
├─ styles/
└─ main.tsx
```

---

## 🧭 Fluxo de Navegação (MVP)

1. Login / Register
2. Dashboard
3. Contas
4. Categorias / Subcategorias
5. Transações
6. Acompanhamento mensal

---

## 🔐 Autenticação

- JWT (access + refresh)
- Access token em memória
- Refresh token via cookie httpOnly
- Endpoint `/me`
- Guard de rotas com TanStack Router

---

## 📐 Regras de Negócio no Frontend

- Categoria é obrigatória na transação
- Subcategoria depende da categoria
- Subcategoria herda o tipo da categoria
- Alterar categoria remove subcategoria
- Valores sempre positivos (tipo define fluxo)

---

## 🚦 Ordem de Implementação

1. Setup do projeto
2. Autenticação
3. Layout base
4. Dashboard
5. Transactions
6. Accounts
7. Categories / Subcategories
8. Polimento de UX

---

## ✅ Status

- [x] Criação do projeto
- [x] Instalação das dependências base
- [x] Tailwind CSS v4.1 configurado e funcionando
- [x] shadcn/ui
- [ ] Router
- [ ] Auth
- [ ] Layout base
- [ ] Dashboard
