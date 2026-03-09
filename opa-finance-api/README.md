# 🏦 Backend — Sistema de Controle Financeiro

Fastify • TypeScript • Drizzle ORM • PostgreSQL • JWT • Zod

Este backend faz parte do sistema de controle financeiro projetado para permitir que usuários acompanhem seus gastos, receitas e tenham visão clara sobre sua vida financeira.

O projeto segue arquitetura modular, autenticação JWT moderna e banco normalizado, pronto para escalar.

---

## 📌 Índice

- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Módulos do Sistema](#módulos-do-sistema)
- [Modelagem do Banco (ERD)](#modelagem-do-banco-erd)
- [Regras de Negócio](#regras-de-negócio)
- [Padrões do Projeto](#padrões-do-projeto)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e Execução](#instalação-e-execução)
- [Scripts](#scripts)
- [Documentação](#documentação)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Roadmap](#roadmap)

---

## 🚀 Tecnologias

### **Backend**

- Fastify
- TypeScript
- Zod (validação)
- JWT (access + refresh token)
- Cookies httpOnly + secure
- bcrypt (criptografia)
- Drizzle ORM
- PostgreSQL

### **Infraestrutura**

- Docker + Docker Compose
- Nginx (proxy reverso)
- Certbot (HTTPS)
- Portainer (gestão da VPS)

---

## 🧱 Arquitetura

O backend segue arquitetura limpa e modular:

```
src/
  modules/
    auth/
    accounts/
    categories/
    subcategories/
    transactions/
    transfers/
  core/
    config/
    plugins/
    middlewares/
    utils/
    errors/
  server.ts
  app.ts
```

Camadas:

- **Routes** → define rotas
- **Controller** → recebe requisições
- **Service** → implementa regras de negócio
- **Repository** → comunicação com o banco
- **Schemas** → validações Zod

Autenticação:

- Access token → memória/headers
- Refresh token → cookie httpOnly + secure
- Backend **stateless**

---

## 🗄 Modelagem do Banco (ERD)

ERD completo está disponível em:

```
/docs/erd_finance_system.svg
```

Entidades principais:

- users
- accounts
- categories
- subcategories
- transactions

---

## 📜 Regras de Negócio

### **Accounts**

- Saldo não é armazenado → calculado por:
  `initial_balance + soma(transactions.amount)`
- Não excluir se houver transações
- Conta pode ser marcada como oculta no dashboard (`isHiddenOnDashboard`)
- Conta principal não pode ser ocultada; ao definir principal, a conta fica visível no dashboard

### **Categories**

- Personalizadas por usuário
- Obrigatórias na transação
- Não excluir se usada

### **Subcategories**

- Herdam automaticamente o tipo da categoria
- Opcional nas transações
- Nome pode repetir em categorias diferentes
- Não excluir se usada

### **Transactions**

- category_id obrigatório
- subcategory_id opcional
- Mudar categoria remove subcategoria
- Soma no saldo da conta
- Paginação obrigatória
- transfer_id opcional (vincula transações de transferências)

### **Transfers**

- Transferência entre contas do mesmo usuário
- Implementada como duas transações (débito na origem, crédito no destino)
- Utiliza categoria de sistema "Transferência"
- Operação atômica (transação de banco de dados)
- Contas de origem e destino devem ser diferentes

### **Autenticação**

- Refresh token seguro em cookie httpOnly
- Access token curto retornado no body
- Senhas criptografadas com bcrypt

---

## 🧩 Módulos do Sistema

### 🔐 Auth

- Registro
- Login
- Refresh
- Logout
- `/me`

### 🏦 Accounts

Personalizáveis:

- nome
- tipo
- cor
- ícone

Tipos suportados:

- cash
- checking_account
- savings_account
- credit_card
- investment

### 🗂 Categories

- income / expense
- cor opcional

### 🧩 Subcategories

- herdadas da categoria
- opcionais
- personalizadas

### 💸 Transactions

- CRUD completo
- paginação
- filtros
- top gastos (categoria/subcategoria)
- dashboard mensal
- suporte a `excludeHiddenAccounts` em queries de dashboard

### 🔄 Transfers

- Transferência entre contas
- Validação de acesso às contas
- Operação atômica

### 🧾 Audit

- Trilhas de auditoria para operacoes de negocio
- Registro de `create`, `update` e `delete`
- Suporte a rastreabilidade por usuario

---

## ✅ Pré-requisitos

- Node.js 18+
- npm 9+
- PostgreSQL **local ou remoto** configurado
  - Alternativa: subir PostgreSQL via Docker + Docker Compose

## 📦 Instalação e Execução

### 1️⃣ Clonar repositório

```sh
git clone https://github.com/SEU_USUARIO/NOME_DO_REPO.git
cd opa-finance-api
```

### 2️⃣ Instalar dependências

```sh
npm install
```

### 3️⃣ Configurar ambiente

Crie o arquivo `.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/api_finance_dev"
DATABASE_URL_TEST="postgresql://USER:PASSWORD@localhost:5432/api_finance_test"
JWT_SECRET="sua_chave_segura"
REFRESH_TOKEN_SECRET="outra_chave_segura"
LOG_LEVEL="info"
CORS_ORIGINS="*"
SSH_HOST="user@server"
SSH_KEY="~/.ssh/id_ed25519"
SSH_CONTAINER_NAME="postgres_infra"
SSH_POSTGRES_USER="api_finance_api"
SSH_POSTGRES_DB="api_finance"
SSH_POSTGRES_DEV_DB="api_finance_dev"
SSH_POSTGRES_TEST_DB="api_finance_test"
```

> 📌 **Onde colocar:** crie o arquivo `.env` **na raiz do backend** (pasta `opa-finance-api/`).

Convencao de ambientes:

- `prod`: `SSH_POSTGRES_DB`
- `dev`: `DATABASE_URL` e `SSH_POSTGRES_DEV_DB`
- `test`: `DATABASE_URL_TEST` e `SSH_POSTGRES_TEST_DB`

Niveis de log suportados: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.

### 4️⃣ Rodar migrations

```sh
npm run db:migrate
```

> Após rodar as migrations, inicie o backend normalmente.

### 5️⃣ Rodar servidor

```sh
npm run dev
```

## 🔄 Espelhamento de producao para dev

Para manter um banco de desenvolvimento remoto sem rodar Docker local, o projeto inclui um script de espelhamento seguro:

```sh
npm run db:sync:dev
```

Detalhes do fluxo de trabalho para devs, ambientes, backup, sanitizacao e validacao estao em:

- [docs/guia_fluxo_trabalho_devs.md](docs/guia_fluxo_trabalho_devs.md)

### 📖 Swagger

Em `development`/`test`, a documentação Swagger fica disponível em:

```
http://localhost:3333/docs
```

### 🔖 Versão da API

- Endpoint: `GET /version`
- Retorna:
  - `version`
  - `commit`
  - `buildTime`
- O backend gera metadados de versão em `predev` e `prebuild` via `npm run version:generate`.

---

## 🏗 Estrutura de Pastas (detalhada)

```
src/
  app.ts
  server.ts

  core/
    config/
    plugins/
    middlewares/
    errors/
    utils/

  modules/
    auth/
    accounts/
    categories/
    subcategories/
    transactions/
    transfers/
```

---

## 📜 Scripts

- `npm run dev` — servidor local
- `npm run db:migrate` — aplica migrations no banco de `dev`
- `npm run db:test:migrate` — aplica migrations no banco de `test`
- `npm run db:studio` — abre Drizzle Studio para o banco de `dev`
- `npm run db:test:studio` — abre Drizzle Studio para o banco de `test`
- `npm run db:reset` — reset interativo remoto de `prod`, `dev` ou `test`
- `npm run db:reset:dev` — reset remoto direto do banco de `dev`
- `npm run db:reset:test` — reset remoto direto do banco de `test`
- `npm run db:reset:prod` — reset remoto direto do banco de `prod`
- `npm run db:archive` — backup/restore interativo remoto
- `npm run db:sync:dev` — espelha `prod` em `dev`
- `npm run test` — executa testes no banco de `test`

## 📄 Documentação

- Swagger (dev/test): `http://localhost:3333/docs`
- Documento consolidado: [docs/documento_consolidado_planejamento.md](docs/documento_consolidado_planejamento.md)
- Módulos:
  - [Auth](docs/modules/modules_auth.md)
  - [Accounts](docs/modules/modules_accounts.md)
  - [Categories](docs/modules/modules_categories.md)
  - [Subcategories](docs/modules/modules_subcategories.md)
  - [Transactions](docs/modules/modules_transactions.md)
  - [Transfers](docs/modules/modules_transfers.md)
  - [Audit](docs/modules/modules_audit.md)

## 🧪 Testes

Ferramentas:

- Vitest
- fastify.inject
- PostgreSQL dedicado para testes

Testes:

- Unitários
- Integração
- Banco
- Segurança

---

## 🗺 Roadmap Atual

1. Backend base + auth
2. Accounts
3. Categories
4. Subcategories
5. Transactions
6. Transfers ✅
7. Dashboard
8. Testes
9. Documentação
10. Frontend
11. Deploy VPS
12. Pós-MVP

---

## 👨‍💻 Autor

**Bruno S Velho**

- Email: bruno.velho@gmail.com
- GitHub: https://github.com/vbruno
- LinkedIn: https://www.linkedin.com/in/brunovelho/
