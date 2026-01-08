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

### Tema (claro/escuro)

- Tokens de cor definidos em `src/index.css` com suporte a `.dark`.
- `ThemeProvider` aplica a classe `dark` no `html` e sincroniza com `localStorage`.
- Toggle disponível no header (área privada) e na tela de login.

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
- Zustand (estado global quando necessário)

### Qualidade de Código

- ESLint v9 (Flat Config)
- Prettier

---

## 🗂️ Arquitetura de Pastas (Frontend)

```txt
src/
├─ index.css
├─ features/
│  ├─ accounts/           # Hooks + tipos de contas
│  ├─ auth/               # Store e hooks de auth
│  ├─ categories/         # Hooks + tipos de categorias/subcategorias
│  ├─ profile/            # Hooks de perfil
│  ├─ system/             # Health/ping
│  ├─ transactions/       # Hooks + tipos de transações
│  └─ transfers/          # Hooks + tipos de transferências
├─ routes/
│  ├─ __root.tsx
│  ├─ index.tsx           # Landing / redirect inicial
│  ├─ login.tsx           # Login (rota pública)
│  └─ app/
│     ├─ route.tsx        # Layout + Auth Guard
│     ├─ index.tsx        # Dashboard
│     ├─ profile.tsx      # Perfil (editar nome + senha)
│     ├─ register.tsx     # Criar usuário (rota privada, acesso direto)
│     ├─ accounts.tsx     # Contas
│     ├─ accounts/
│     │  └─ $id.tsx       # Detalhe da conta
│     └─ transactions.tsx # Transações
├─ components/
│  ├─ ui/                 # shadcn/ui
│  └─ app/
│     ├─ Header.tsx
│     └─ Sidebar.tsx
│  └─ theme/
│     ├─ ThemeProvider.tsx
│     └─ ThemeToggle.tsx
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
│  ├─ user.schema.ts      # Perfil e alteração de senha
│  ├─ account.schema.ts   # Contas
│  ├─ category.schema.ts  # Categorias
│  ├─ subcategory.schema.ts # Subcategorias
│  ├─ transaction.schema.ts # Transações
│  └─ transfer.schema.ts  # Transferências
├─ routeTree.gen.ts
├─ main.tsx
```

---

## 🧩 System Design

O frontend segue um **feature-based architecture** (modular por dominio).
Cada feature concentra seus hooks de dados e tipos em `src/features/*`,
enquanto as rotas (`src/routes/*`) focam na UI e orquestracao.

## 🧭 Fluxo de Navegação (MVP)

1. Login
2. Área protegida `/app`
3. Usuário (perfil + troca de senha)
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
- Menu do usuário no header com acesso ao perfil e logout
- Criação de usuário disponível em `/app/register` (rota privada, sem link no sidebar)

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
- Queries/mutations centralizadas em hooks por feature (`src/features/*`)

## ⏳ Estados de Loading

- Dashboard usa skeletons para KPIs, últimas transações, top categorias e contas.
- Skeletons são exibidos até as queries estarem habilitadas e concluírem.

## 🧮 Seleção de Transações

- A tabela de transações permite selecionar linhas para calcular soma e média.
- O resumo aparece acima da tabela quando há 2+ linhas selecionadas.
- Cálculo considera valores com sinal (receitas positivas, despesas negativas).
- Soma e média podem ser clicadas para copiar o valor formatado.
- Ao copiar, um feedback "Copiado!" aparece temporariamente.

## 🧠 Estado Global (padrão)

- Usar Zustand apenas quando o estado for realmente compartilhado entre telas/fluxos.
- Exemplos: filtros globais de periodo, conta/portfolio selecionado entre telas, preferencia de exibicao.

---

## 📐 Regras de Negócio no Frontend

- Categoria é obrigatória na transação
- Subcategoria depende da categoria
- Subcategoria herda o tipo da categoria
- Alterar categoria remove subcategoria
- Valores sempre positivos (tipo define fluxo)
- Transferências são criadas na tela de transações (modal dedicado)

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
- [x] Tema claro/escuro com toggle
- [x] Usuário (perfil, edição de nome, troca de senha, logout)
- [x] Accounts (tabela, filtros/ordenação/paginação na URL, CRUD via API, modais de detalhes/criação/edição, exclusão com confirmação e deep link)
- [x] Categories / Subcategories
- [x] Transactions (listagem, filtros na URL, ordenação server-side, CRUD, modais)
- [x] Transfers (modal na tela de transacoes, validacao e integracao com API)
- [ ] Dashboard (dados reais)

---

## 🧩 Accounts — Notas de Implementação

- Tabela com filtros (nome/tipo) e ordenação por coluna; estado persistido na URL.
- Paginação client-side (10 itens) exibida apenas quando necessário, com navegação por página.
- Modais de criação, edição, detalhes e exclusão com confirmação; foco automático, `Esc` para fechar e scroll do body bloqueado.
- Deep link para detalhes via `/app/accounts/$id` redirecionando para `/app/accounts?id=...`.
- Exclusão bloqueada pelo backend quando há transações (`409`), exibindo mensagem no modal de confirmação.

---

## 🧩 Categories / Subcategories — Notas de Implementação

- Tela única para categorias e subcategorias com expansão por linha.
- Categorias de sistema não aparecem na listagem.
- CRUD de categorias e subcategorias via modais, com validação Zod e mensagens de erro amigáveis.
- Busca e filtro por tipo na URL; busca ignora acentos e expande automaticamente categorias com match (com override manual).
- Subcategorias são carregadas sob demanda por categoria; busca em subcategorias usa debounce (300ms).
- Busca em contas também usa debounce (300ms) para reduzir chamadas e updates de URL.
- Expansão automática respeita ajustes manuais enquanto houver termo de busca.

---

## 🧩 Transactions — Notas de Implementação

- Listagem com filtros persistidos na URL (data, tipo, conta, categoria, subcategoria, descricao).
- Ordenacao server-side via `sort`/`dir` (backend).
- Busca em descricao opcionalmente inclui notas (checkbox).
- Modal de detalhes, criacao, edicao e exclusao.

---

## 🧩 Transfers — Notas de Implementação

- Criacao feita na tela de transacoes (modal dedicado).
- Validacao via Zod (contas diferentes, valor positivo, data valida).
- Integracao via `src/features/transfers` com invalidacao de `transactions` e `accounts`.
- Categoria define o tipo da transacao e limpa subcategoria ao trocar.
- Resposta da API ja inclui `accountName`, `categoryName`, `subcategoryName` (evita N+1).
