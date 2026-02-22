# 📐 Regras de Negócio & Orientações — Frontend (Opa Finance)

Este documento define **regras de negócio**, **responsabilidades do frontend** e **boas práticas de desenvolvimento**
para o projeto **opa-finance-front**.

Ele serve como referência contínua para garantir **consistência**, **previsibilidade** e **alinhamento com o backend**.

---

## 🎯 Objetivo deste documento

- Evitar regras duplicadas ou conflitantes
- Garantir UX consistente
- Definir claramente o que é responsabilidade do frontend
- Facilitar evolução do sistema

---

## 🧠 Princípios Gerais

### 1. Frontend NÃO é fonte da verdade

- Backend é sempre a autoridade final
- Frontend valida para **UX**, não para segurança

### 2. Regras devem existir em 2 níveis

- **Frontend:** feedback imediato ao usuário
- **Backend:** validação definitiva

### 3. Estados devem ser previsíveis

- Evitar lógica escondida em componentes
- Preferir regras explícitas

---

## 💰 Domínio Financeiro — Regras

### 🔹 Categorias

- Toda transação **deve** possuir categoria
- Categoria possui:
  - `id`
  - `name`
  - `type`: `income | expense`
- Categorias de sistema:
  - `system: true` e `userId: null`
  - **Não** aparecem na listagem de categorias do usuário
  - **Não** podem ser editadas ou removidas pelo usuário

### 🔹 Subcategorias

- Subcategoria **depende obrigatoriamente** de uma categoria
- Subcategoria **herda o tipo da categoria**
- Não pode existir:
  - Categoria `income` com subcategoria `expense`
  - Categoria `expense` com subcategoria `income`
- Busca por categoria/subcategoria deve ignorar acentos

### 🔹 Transações

- Uma transação sempre possui:
  - valor
  - data
  - categoria
- Subcategoria é opcional, mas:
  - se existir, deve pertencer à categoria selecionada
- Valores **sempre positivos**
  - O tipo (`income | expense`) define o fluxo
- Filtros da listagem:
  - Data/conta/categoria/subcategoria/tipo são server-side
  - Descrição é opcional; pode incluir notas quando o usuário marcar a opção
- Ordenação:
  - Deve ser feita no backend usando `sort`/`dir` (lista paginada)

### 🔹 Transferências

- Transferência sempre possui:
  - conta de origem
  - conta de destino
  - valor
  - data
- Contas de origem e destino devem ser diferentes
- Valores sempre positivos
- Descrição é opcional
- Cadastro é feito na tela de transações (modal dedicado)

### 🔹 Alteração de Categoria

- Ao trocar a categoria:
  - Subcategoria deve ser **resetada automaticamente**
  - Frontend deve limpar o campo

---

## 🧾 Contas (Accounts)

- Representam origem/destino do dinheiro
- Exemplo:
  - Conta bancária
  - Carteira
  - Cartão de crédito
- Transações devem estar associadas a uma conta
- Exclusão de conta:
  - Backend bloqueia quando houver transações (`409`)
  - Frontend deve exibir mensagem amigável e impedir a remoção
- Tipos de conta devem seguir os valores da API:
  - `cash`, `checking_account`, `savings_account`, `credit_card`, `investment`
- Visibilidade no dashboard:
  - Conta pode ser marcada como oculta no dashboard (`isHiddenOnDashboard`).
  - Conta principal não pode ser ocultada.
  - No dashboard, contas ocultas não aparecem no seletor/lista e não entram nas métricas quando `excludeHiddenAccounts=true`.
- Listagem de contas:
  - Filtros por nome/tipo são client-side
  - Ordenação por coluna é client-side
  - Paginação é client-side (10 itens por página) e exibida apenas quando necessário

---

## 🧾 Transações (Listagem)

- Listagem é paginada no backend.
- Ordenação e filtros devem ser enviados para a API.
- Campos `accountName`, `categoryName`, `subcategoryName` podem vir direto da API para evitar N+1.

---

## 🔐 Autenticação & Sessão (Frontend)

### Situação atual

- Autenticação integrada com backend
- Access token persistido via `localStorage`
- Refresh token via cookie httpOnly (com `withCredentials`)
- Guard de rotas via TanStack Router (`beforeLoad`)
- Menu do usuário no sidebar com acesso ao perfil e logout

### Comportamento esperado

- Usuário não autenticado:
  - Não acessa `/app/*`
  - É redirecionado para `/login`
- Usuário autenticado:
  - Não acessa `/login`
  - É redirecionado para `/app`
- Logout:
  - Limpa sessão
  - Redireciona para `/login`

### Perfil (Frontend)

- Usuário pode atualizar o próprio nome
- Usuário pode alterar a senha (exige senha atual)
- Email é exibido como somente leitura

### Criação de usuário (Frontend)

- Rota privada: `/app/register`
- Acesso direto (não aparece no sidebar)

---

## 🧭 Navegação & Layout

### Layout `/app`

- Header no topo do layout
- Sidebar persistente
- Conteúdo renderizado via `<Outlet />`

### Sidebar

- Responsável apenas por navegação
- Não contém lógica de negócio
- Item ativo baseado na rota atual

---

## 🔄 Comunicação com API

### Cliente HTTP

- Toda chamada HTTP deve usar:
  - `src/lib/api.ts`
- É proibido:
  - Criar instâncias locais de Axios

### Gerenciamento de dados

- Queries e mutations devem usar TanStack Query

### Interceptors

- Token anexado automaticamente
- Erros globais tratados centralmente
- `401` → tentar refresh e, se falhar, logout + redirecionar para `/login`

---

## 🧩 Organização de Código

### Componentes

- Devem ser:
  - pequenos
  - reutilizáveis
  - previsíveis
- Evitar lógica de negócio pesada em componentes de UI

### Regras & Validações

- Preferir:
  - helpers
  - hooks
  - schemas (Zod)
  - React Hook Form + Zod (resolver)

---

## 🧪 Validações no Frontend

### O que validar

- Campos obrigatórios
- Formato de dados
- Relações entre campos (ex: categoria ↔ subcategoria)

### O que NÃO validar

- Autorização
- Permissões
- Regras críticas de segurança

---

## 🚦 Fluxo de Implementação Recomendada

1. Criar layout/estrutura
2. Criar schema (Zod)
3. Criar UI
4. Conectar com API
5. Refinar UX (loading, erros)

---

## 📝 Observações Finais

- Este documento deve evoluir junto com o projeto
- Sempre que uma regra surgir no backend, avaliar impacto no frontend
- Manter frontend simples, previsível e consistente

---

📌 **Este documento é parte essencial do projeto frontend.**
