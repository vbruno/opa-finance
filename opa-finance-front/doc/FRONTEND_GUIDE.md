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
    @import 'tailwindcss';
    ```

### Roteamento & Navegação

- TanStack Router
  - File-based routing
  - Plugin oficial do Vite (`@tanstack/router-plugin`)
  - Geração automática de `routeTree.gen.ts`
  - Layout por `route.tsx`
  - Guard de rotas via `beforeLoad`

### UI

- shadcn/ui (integrado com Tailwind v4.1)

### Comunicação & Validação

- Axios
- Zod

### Qualidade de Código

- ESLint v9 (Flat Config)
- Prettier

---

## 🗂️ Arquitetura de Pastas (Frontend)

```txt
src/
├─ routes/
│  ├─ __root.tsx
│  ├─ index.tsx           # Landing / redirect inicial
│  ├─ login.tsx           # Login (rota pública)
│  └─ app/
│     ├─ route.tsx        # Layout + Auth Guard
│     ├─ index.tsx        # Dashboard
│     ├─ accounts.tsx     # Contas
│     └─ transactions.tsx # Transações
├─ components/
│  ├─ ui/                 # shadcn/ui
│  └─ app/
│     ├─ Header.tsx
│     └─ Sidebar.tsx
├─ auth/
│  ├─ auth.store.ts       # Estado de auth + persistência
│  └─ useAuth.ts
├─ lib/
│  ├─ api.ts              # Cliente HTTP (Axios)
│  └─ api.interceptors.ts # Interceptors globais
├─ schemas/               # Zod schemas
├─ main.tsx
```

---

## 🧭 Fluxo de Navegação (MVP)

1. Login
2. Dashboard
3. Contas
4. Transações
5. Categorias / Subcategorias
6. Acompanhamento mensal

---

## 🔐 Autenticação

### Situação atual (Frontend)

- Autenticação **mockada** para desenvolvimento
- Estado do usuário centralizado
- Persistência via `localStorage`
- Guard de rotas usando `beforeLoad`
- Rotas públicas: `/`, `/login`
- Rotas protegidas: `/app/*`

### Planejamento futuro

- JWT (access + refresh)
- Access token em memória
- Refresh token via cookie httpOnly
- Endpoint `/me`
- Renovação automática via interceptor

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
2. Layout base + Router
3. Auth Guard + persistência
4. Sidebar + navegação
5. Integração base com API
6. Dashboard
7. Transactions
8. Accounts
9. Categories / Subcategories
10. Polimento de UX

---

## ✅ Status Atual

- [x] Criação do projeto (Vite + React + TS + SWC)
- [x] Dependências base
- [x] Tailwind CSS v4.1 (CSS-first)
- [x] shadcn/ui configurado
- [x] TanStack Router
- [x] Layout base
- [x] Auth Guard
- [x] Persistência de sessão
- [x] Header + Logout
- [x] Sidebar + navegação
- [x] Integração base com API
- [ ] Dashboard (dados reais)
- [ ] Accounts
- [ ] Transactions
- [ ] Categories / Subcategories
