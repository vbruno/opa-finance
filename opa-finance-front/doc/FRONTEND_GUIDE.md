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
- React Hook Form + @hookform/resolvers
- TanStack Query

### Qualidade de Código

- ESLint v9 (Flat Config)
- Prettier

---

## 🗂️ Arquitetura de Pastas (Frontend)

```txt
src/
├─ index.css
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
│  ├─ useAuth.ts
│  └─ useLogin.ts
├─ lib/
│  ├─ api.ts              # Cliente HTTP (Axios)
│  ├─ api.interceptors.ts # Interceptors globais
│  ├─ apiError.ts         # Helper de mensagens de erro
│  ├─ queryClient.ts      # TanStack Query Client
│  └─ utils.ts
├─ router/
│  ├─ RouterProvider.tsx
│  └─ router.ts
├─ schemas/               # Zod schemas
├─ routeTree.gen.ts
├─ main.tsx
```

---

## 🧭 Fluxo de Navegação (MVP)

1. Login
2. Área protegida `/app`
3. Usuário (perfil)
4. Contas
5. Categorias / Subcategorias
6. Transações
7. Transferências
8. Dashboard / Resumo mensal

---

## 🔐 Autenticação

### Situação atual (Frontend)

- Autenticação integrada com backend
- Access token persistido em `localStorage`
- Refresh token via cookie httpOnly (com `withCredentials`)
- Endpoint `/auth/me` para hidratar dados do usuário
- Interceptor para anexar token e renovar em `401`
- Guard de rotas usando `beforeLoad`
- Rotas públicas: `/`, `/login`
- Rotas protegidas: `/app/*`

### Próximos ajustes (se necessário)

- Melhorar UX de loading/erro global para autenticação

---

## 🧾 Formulários (padrão)

- React Hook Form + Zod (resolver)
- Erros de API em `errors.root`
- Validação de campo em tempo real via schema

---

## 📦 Dados & Cache (padrão)

- TanStack Query com `QueryClientProvider` no `main.tsx`
- Queries/mutations centralizadas em hooks por feature

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
6. Usuário (perfil, edição de nome, troca de senha, logout)
7. Accounts
8. Categories / Subcategories
9. Transactions
10. Transfers
11. Dashboard
12. Polimento de UX

---

## 📚 Documentação Complementar

Este guia é complementado pelos seguintes documentos:

- **Regras de Negócio & Orientações (Frontend)**  
  Documento com regras de domínio, responsabilidades do frontend e boas práticas de desenvolvimento.  
  📄 `FRONTEND_REGRAS_DE_NEGOCIO.md`

Esses documentos devem ser lidos em conjunto para garantir:

- alinhamento entre UI e regras de negócio
- consistência de comportamento
- evolução segura do frontend

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
- [x] Login integrado com backend
- [x] Interceptor de auth (token + refresh)
- [x] Formulário de login com React Hook Form + Zod
- [x] TanStack Query configurado
- [ ] Usuário (perfil, edição de nome, troca de senha, logout)
- [ ] Accounts
- [ ] Categories / Subcategories
- [ ] Transactions
- [ ] Transfers
- [ ] Dashboard (dados reais)
