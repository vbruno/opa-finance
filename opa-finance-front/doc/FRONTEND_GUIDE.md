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
- Toggle disponível no sidebar (área privada) e na tela de login.

### Responsividade (Mobile/Desktop)

- Breakpoint principal de desktop: **960px**.
- Utilitários customizados em `src/index.css`:
  - `desktop-only` (exibe apenas >= 960px)
  - `mobile-only` (exibe apenas < 960px)
  - `desktop-force-block` (força bloco no desktop mesmo com `hidden`)
- Layout: sidebar fixo no desktop, drawer no mobile; scroll principal fica no conteúdo (`main`).

### Roteamento & Navegação

- TanStack Router
  - File-based routing
  - Plugin oficial do Vite (`@tanstack/router-plugin`)
  - Geração automática de `routeTree.gen.ts`
  - Layout por `route.tsx`
  - Guard de rotas via `beforeLoad`

### UI

- shadcn/ui (integrado com Tailwind v4.1)
- `Select` customizado via Radix em `src/components/ui/select.tsx`.

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
- Em falha de conexão com o backend (sem resposta), o frontend faz logout e redireciona para `/unavailable`, com opção de verificar o status do servidor.
- Guard de rotas usando `beforeLoad`
- Rotas públicas: `/`, `/login`
- Rotas protegidas: `/app/*`
- Menu do usuário no header com acesso ao perfil e logout
- Menu do usuário fica no sidebar (perfil + logout)
- Criação de usuário disponível em `/app/register` (rota privada, sem link no sidebar)

### Próximos ajustes (se necessário)

- Melhorar UX de loading/erro global para autenticação

---

## 🚀 Deploy / Containerizacao

- Build de producao: `npm run build` gera `dist/`.
- Servir `dist/` com Nginx (SPA) e fallback para `index.html`.
- Proxy recomendado no Nginx:
  - `VITE_API_URL=/api`
  - Nginx encaminha `/api/` -> `http://opa-finance-api:3333/`
- `VITE_API_URL` e build-time; qualquer alteracao exige rebuild do frontend.

---

## 🧾 Formulários (padrão)

- React Hook Form + Zod (resolver)
- Erros de API em `errors.root`
- Validação de campo em tempo real via schema
- No modal de nova transação, data inicia no dia atual e a conta principal é pré-selecionada.
- No modal de transferência, data inicia no dia atual e a conta de origem começa na conta principal.
- No modal de transferência, há um botão para inverter conta de origem/destino.
- Ao editar uma transferência, o frontend abre o modal de transferência e atualiza os dois lançamentos (origem e destino).
- No modal de nova/editar transação, o foco inicia em Descrição e a navegação por Tab segue: Descrição → Notas → Valor → Categoria → Subcategoria → Data → Conta.
- Inputs de data no mobile não permitem digitação manual; clique em qualquer parte do campo abre o datepicker.
- Na barra de resumo da seleção (2+ itens), existe botão para excluir em massa com confirmação.
- Exclusão de transações de transferência é tratada no backend (remove origem e destino), sem seleção automática no front.
- O campo de descrição da nova transação usa `/transactions/descriptions` para sugerir até 5 descrições da conta atual (preenche apenas a descrição), enviando `q` quando há espaço no texto ou após 1s sem digitação, e refinando sem acentos no front.
- No autocomplete de descrição, use setas ↑/↓ para navegar, Enter para selecionar e Esc para fechar.
- No modal de detalhes, o botão "Duplicar" abre a criação com os dados da transação (exceto transferências) e data atual.
- Em detalhes de transferências, o botão "Repetir" abre a nova transferência com contas origem/destino, valor e descrição preenchidos, usando a data atual. Se a contraparte não estiver na lista filtrada, o frontend busca a outra ponta pelo mesmo dia para garantir os dados.

---

## 📦 Dados & Cache (padrão)

- TanStack Query com `QueryClientProvider` no `main.tsx`
- Queries/mutations centralizadas em hooks por feature (`src/features/*`)

## ⏳ Estados de Loading

- Dashboard usa skeletons para KPIs, últimas transações, top categorias e contas.
- No bloco de contas do dashboard, há um totalizador com a soma das contas listadas.
- Na tela de contas, o rodapé da tabela exibe o total dos saldos das contas filtradas.
- Na tela de contas, é possível selecionar contas; se 1+ selecionadas, o rodapé mostra "Parcial" com a soma das selecionadas e o contador de selecionadas.
- No dashboard, as últimas transações abrem um modal de detalhes ao clicar.
- No modal de detalhes de transação, é possível clicar em descrição e valor para copiar, com feedback "Copiado!".
- No dashboard, "Top 5 Despesas" e "Top 5 Receitas" iniciam recolhidos; cada item abre modal com os 5 últimos lançamentos, com acesso ao detalhe e link para ver todas.
- Skeletons são exibidos até as queries estarem habilitadas e concluírem.

## 🧮 Seleção de Transações

- A tabela de transações permite selecionar linhas para calcular soma e média.
- O resumo aparece acima da tabela quando há 2+ linhas selecionadas.
- Cálculo considera valores com sinal (receitas positivas, despesas negativas).
- Soma e média podem ser clicadas para copiar o valor formatado.
- Ao copiar, um feedback "Copiado!" aparece temporariamente.
- Atalho: `N` abre nova transação; `T` abre nova transferência (fora de inputs).
- No modal de transação, use `Alt + 1..7` para focar rapidamente os campos (conta, categoria, subcategoria, data, valor, descrição, notas).
- Na tela de transações, pressionar `Esc` com filtros ativos limpa os filtros.
- Na tela de transações, o filtro "Buscar por valor" usa o input principal e aceita: número exato (`123,45`), comparadores (`>100`, `<= 50`), intervalo com `;` (`100;200`) e expressões aritméticas iniciadas por `=` (`=100+20/2`).

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
- [x] Responsividade mobile/desktop (breakpoint 960px + utilitários customizados)
- [x] Sidebar fixa no desktop e drawer no mobile (scroll apenas no conteúdo)
- [x] Usuário (perfil, edição de nome, troca de senha, logout)
- [x] Accounts (tabela, filtros/ordenação/paginação na URL, CRUD via API, modais de detalhes/criação/edição, exclusão com confirmação e deep link)
- [x] Categories / Subcategories
- [x] Transactions (listagem, filtros na URL, ordenação server-side, CRUD, modais)
- [x] Transfers (modal na tela de transacoes, validacao e integracao com API)
- [x] Dashboard (dados reais)
- [x] Selects customizados (shadcn) nos filtros e modais
- [x] Atalhos de teclado (Categorias: C/S, Transações: N/T)
- [x] UX mobile (inputs de data via datepicker, botões maiores no login)
- [x] Resumo de seleção em transações (média/soma + exclusão em massa)
- [x] Filtros colapsáveis no mobile (Contas, Categorias, Transações)
- [x] Tooltip de "Copiado!" ao copiar valores

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
- Botão único "Criar" com menu (Categoria/Subcategoria) em todas as larguras.
- Atalhos: `C` abre criar categoria, `S` abre criar subcategoria (fora de inputs).
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
- Botão "Adicionar" com menu (Transação/Transferência) em todas as larguras.
- Atalhos: `N` (transação) e `T` (transferência), com indicação no menu.
- Selects do filtro e modais usam `Select` customizado do shadcn.

---

## 🧩 Transfers — Notas de Implementação

- Criacao feita na tela de transacoes (modal dedicado).
- Validacao via Zod (contas diferentes, valor positivo, data valida).
- Integracao via `src/features/transfers` com invalidacao de `transactions` e `accounts`.
- Categoria define o tipo da transacao e limpa subcategoria ao trocar.
- Resposta da API ja inclui `accountName`, `categoryName`, `subcategoryName` (evita N+1).
