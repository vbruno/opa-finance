# 📚 Referência da API — Frontend

Documentação completa da API para integração com o frontend.

---

## 📋 Índice

- [Configuração Base](#configuração-base)
- [Autenticação](#autenticação)
- [Estrutura de Erros](#estrutura-de-erros)
- [Health](#-health)
- [Endpoints](#endpoints)
  - [Auth](#auth)
  - [Users](#users)
  - [Accounts](#accounts)
  - [Categories](#categories)
  - [Subcategories](#subcategories)
  - [Transactions](#transactions)
  - [Transfers](#transfers)
  - [Recurrences](#recurrences)
  - [Reports](#reports)
  - [Audit](#audit)

---

## 🔗 Navegação rápida

- Swagger UI: [/docs](http://localhost:3333/docs)
- JSON OpenAPI: [/docs/json](http://localhost:3333/docs/json)
- Import Insomnia: [insomnia-import-opa-finance.json](./insomnia-import-opa-finance.json)

---

## 🔧 Configuração Base

### Base URL

```
Development: http://localhost:3333
Production: https://api.seudominio.com
```

### Headers

Todas as requisições autenticadas devem incluir:

```http
Authorization: Bearer {accessToken}
Content-Type: application/json
```

### Cookies

O refresh token é enviado automaticamente via cookie `refreshToken` (httpOnly, secure).

---

## 🔐 Autenticação

### Fluxo de Autenticação

1. **Registro/Login**: Recebe `accessToken` no body
2. **Refresh Token**: Armazenado automaticamente em cookie httpOnly
3. **Renovação**: Use `/auth/refresh` quando o access token expirar
4. **Requisições**: Envie `accessToken` no header `Authorization: Bearer {token}`

### Tratamento de Erros de Autenticação

- **401 Unauthorized**: Token inválido ou expirado
  - Tente renovar com `/auth/refresh`
  - Se falhar, redirecione para login

---

## ⚠️ Estrutura de Erros

Todos os erros seguem o padrão **RFC 7807** (Problem Details):

```json
{
  "type": "https://opa.dev/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Mensagem de erro específica",
  "instance": "/transactions"
}
```

### Códigos de Status

- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Erro de validação
- `401` - Não autenticado
- `403` - Acesso negado
- `404` - Recurso não encontrado
- `409` - Conflito (ex: nome duplicado)
- `500` - Erro interno do servidor

---

## 📡 Endpoints

---

## ❤️ Health

### GET `/health`

Health check simples da API.

**Response 200:**

```json
{
  "status": "ok"
}
```

---

### GET `/`

Retorna mensagem básica de status.

**Response 200:**

```json
{
  "message": "API funcionando!"
}
```

---

## 🔑 Auth

### POST `/auth/register`

Registra um novo usuário.

**Request Body:**

```json
{
  "name": "João Silva",
  "email": "joao@example.com",
  "timezone": "Australia/Adelaide",
  "password": "MinhaSenh@123",
  "confirmPassword": "MinhaSenh@123"
}
```

**Validações:**

- `name`: mínimo 3 caracteres, máximo 255
- `email`: formato válido, máximo 255
- `timezone`: opcional, timezone IANA válido (ex.: `Australia/Adelaide`)
- `password`: mínimo 8 caracteres, deve conter maiúscula, minúscula, número e caractere especial
- `confirmPassword`: deve ser igual a `password`

**Response 201:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Erros:**

- `400` - Validação falhou
- `409` - Email já cadastrado

---

### POST `/auth/login`

Autentica um usuário.

**Request Body:**

```json
{
  "email": "joao@example.com",
  "password": "MinhaSenh@123"
}
```

**Response 200:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Erros:**

- `400` - Validação falhou
- `401` - Credenciais inválidas

---

### POST `/auth/refresh`

Renova o access token usando o refresh token (cookie).

**Request:** Sem body, usa cookie `refreshToken`

**Response 200:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Erros:**

- `401` - Refresh token inválido ou expirado

---

### GET `/auth/me`

Retorna dados do usuário autenticado.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "id": "uuid",
  "name": "João Silva",
  "email": "joao@example.com",
  "timezone": "Australia/Adelaide",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `401` - Não autenticado
- `404` - Usuário não encontrado

---

### POST `/auth/logout`

Realiza logout (limpa cookie).

**Response 200:**

```json
{
  "message": "Logout realizado com sucesso."
}
```

---

### POST `/auth/check-password-strength`

Verifica força da senha (útil para validação em tempo real).

**Request Body:**

```json
{
  "password": "MinhaSenh@123"
}
```

**Response 200:**

```json
{
  "strength": "strong" // "weak" | "medium" | "strong"
}
```

---

### POST `/auth/change-password`

Altera senha do usuário autenticado.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "currentPassword": "SenhaAtual123!",
  "newPassword": "NovaSenha456!",
  "confirmPassword": "NovaSenha456!"
}
```

**Response 200:**

```json
{
  "message": "Senha alterada com sucesso."
}
```

**Erros:**

- `400` - Validação falhou
- `401` - Senha atual incorreta

---

### POST `/auth/forgot-password`

Solicita redefinição de senha.

**Request Body:**

```json
{
  "email": "joao@example.com"
}
```

**Response 200:**

```json
{
  "message": "Se o email existir, enviaremos um link de redefinição.",
  "resetToken": "token-para-reset" // apenas em desenvolvimento
}
```

---

### POST `/auth/reset-password`

Redefine senha usando token de reset.

**Request Body:**

```json
{
  "email": "joao@example.com",
  "resetToken": "token-recebido-por-email",
  "newPassword": "NovaSenha456!",
  "confirmPassword": "NovaSenha456!"
}
```

**Response 200:**

```json
{
  "message": "Senha redefinida com sucesso."
}
```

---

## 👤 Users

### GET `/users`

Retorna o usuário autenticado (sem listar outros usuários).

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 10)
- `name` (string, filtro aplicado apenas ao próprio usuário)
- `email` (string, filtro aplicado apenas ao próprio usuário)

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@example.com",
      "timezone": "Australia/Adelaide",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "page": 1,
  "limit": 10
}
```

---

### GET `/users/timezones`

Retorna catálogo de timezones válidos conforme backend (fonte: `pg_timezone_names`).

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "data": ["Australia/Adelaide", "America/Sao_Paulo", "UTC"]
}
```

---

### GET `/users/:id`

Obtém um usuário específico.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "id": "uuid",
  "name": "João Silva",
  "email": "joao@example.com",
  "timezone": "Australia/Adelaide",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `403` - Apenas o próprio usuário pode acessar
- `404` - Usuário não encontrado

---

### PUT `/users/:id`

Atualiza um usuário.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "name": "João Silva Santos", // opcional
  "timezone": "Australia/Adelaide" // opcional
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "name": "João Silva Santos",
  "email": "joao@example.com",
  "timezone": "Australia/Adelaide",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `403` - Apenas o próprio usuário pode atualizar
- `404` - Usuário não encontrado
- `400` - Timezone inválido

---

### DELETE `/users/:id`

Deleta um usuário.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "message": "Usuário removido com sucesso."
}
```

**Erros:**

- `403` - Apenas o próprio usuário pode deletar
- `404` - Usuário não encontrado

---

## 🏦 Accounts

### POST `/accounts`

Cria uma nova conta.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "name": "Conta Corrente",
  "type": "checking_account",
  "isPrimary": true, // opcional
  "color": "#3B82F6", // opcional
  "icon": "wallet" // opcional
}
```

**Tipos de Conta:**

- `cash` - Dinheiro
- `checking_account` - Conta Corrente
- `savings_account` - Poupança
- `credit_card` - Cartão de Crédito
- `investment` - Investimento

**Response 201:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Conta Corrente",
  "type": "checking_account",
  "currentBalance": 0,
  "isPrimary": false,
  "color": "#3B82F6",
  "icon": "wallet",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Notas:**

- A primeira conta criada é marcada como principal automaticamente.
- O saldo da conta inicia em 0. Para adicionar saldo, crie uma transação.

---

### GET `/accounts`

Lista todas as contas do usuário.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "name": "Conta Corrente",
    "type": "checking_account",
    "currentBalance": 1250.5,
    "isPrimary": false,
    "color": "#3B82F6",
    "icon": "wallet",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

---

### GET `/accounts/:id`

Obtém uma conta específica.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Conta Corrente",
  "type": "checking_account",
  "currentBalance": 1250.5,
  "isPrimary": false,
  "color": "#3B82F6",
  "icon": "wallet",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `403` - Conta não pertence ao usuário
- `404` - Conta não encontrada

---

### PUT `/accounts/:id`

Atualiza uma conta.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "name": "Conta Corrente Principal", // opcional
  "type": "checking_account", // opcional
  "isPrimary": true, // opcional
  "color": "#10B981", // opcional
  "icon": "bank" // opcional
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Conta Corrente Principal",
  "type": "checking_account",
  "currentBalance": 1250.5,
  "isPrimary": true,
  "color": "#10B981",
  "icon": "bank",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros:**

- `403` - Conta não pertence ao usuário
- `404` - Conta não encontrada
- `409` - Não é permitido deixar o usuário sem conta principal

---

### DELETE `/accounts/:id`

Deleta uma conta.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "message": "Conta removida com sucesso."
}
```

**Erros:**

- `403` - Conta não pertence ao usuário
- `404` - Conta não encontrada
- `409` - Conta possui transações e não pode ser removida
- `409` - Conta principal não pode ser removida (defina outra como principal)

---

### PUT `/accounts/:id/primary`

Define uma conta como principal (desmarca a anterior automaticamente).

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Conta Corrente",
  "type": "checking_account",
  "currentBalance": 1250.5,
  "isPrimary": true,
  "color": "#3B82F6",
  "icon": "wallet",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `403` - Conta não pertence ao usuário
- `404` - Conta não encontrada
- `409` - Não foi possível definir conta principal

---

## 🗂 Categories

### POST `/categories`

Cria uma nova categoria.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "name": "Alimentação",
  "description": "Gastos com mercado e refeições", // opcional
  "type": "expense"
}
```

**Tipos:**

- `income` - Receita
- `expense` - Despesa

**Observação importante:**
Somente a categoria de sistema "Transferência" pode ser usada em transações.
Ela aceita tanto `income` quanto `expense` para manter a consistência de
transferências entre contas.

**Response 201:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Alimentação",
  "description": "Gastos com mercado e refeições",
  "type": "expense",
  "system": false,
  "color": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `400` - Validação falhou
- `409` - Já existe categoria de sistema com esse nome

---

### GET `/categories`

Lista todas as categorias do usuário (inclui categorias de sistema).

**Headers:** `Authorization: Bearer {token}`

**Observação importante:**
As categorias de sistema aparecem no list, mas apenas a categoria de sistema
"Transferência" pode ser usada em transações. Outras categorias de sistema são
somente leitura e não podem ser selecionadas no POST/PUT de `/transactions`.

**Response 200:**

```json
[
  {
    "id": "uuid",
    "userId": null, // null para categorias de sistema
    "name": "Transferência",
    "description": null,
    "type": "expense",
    "system": true,
    "color": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  {
    "id": "uuid",
    "userId": "uuid",
    "name": "Alimentação",
    "description": "Gastos com mercado e refeições",
    "type": "expense",
    "system": false,
    "color": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

---

### POST `/categories/bootstrap-defaults`

Cria categorias e subcategorias básicas para onboarding do usuário.

**Headers:** `Authorization: Bearer {token}`

**Observação importante:**
Operação **idempotente**. Se já existir categoria/subcategoria com mesmo nome
no usuário, ela não será duplicada.

**Response 200:**

```json
{
  "message": "Categorias básicas processadas com sucesso.",
  "createdCategories": 6,
  "createdSubcategories": 12
}
```

**Erros:**

- `401` - Não autenticado

---

### GET `/categories/:id`

Obtém uma categoria específica.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Alimentação",
  "description": "Gastos com mercado e refeições",
  "type": "expense",
  "system": false,
  "color": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `403` - Categoria não pertence ao usuário (ou não é de sistema)
- `404` - Categoria não encontrada

---

### PUT `/categories/:id`

Atualiza uma categoria.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "name": "Alimentação e Bebidas", // opcional
  "description": "Inclui mercado e refeições fora" // opcional (pode ser null)
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Alimentação e Bebidas",
  "description": "Inclui mercado e refeições fora",
  "type": "expense",
  "system": false,
  "color": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros:**

- `403` - Categoria de sistema não pode ser alterada
- `404` - Categoria não encontrada
- `409` - Nome já existe em categoria de sistema

---

### DELETE `/categories/:id`

Deleta uma categoria.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "message": "Categoria removida com sucesso."
}
```

**Erros:**

- `403` - Categoria de sistema não pode ser removida
- `404` - Categoria não encontrada
- `409` - Categoria possui subcategorias e não pode ser removida
- `409` - Categoria com recorrência ativa vinculada não pode ser removida

---

## 🧩 Subcategories

### POST `/subcategories`

Cria uma nova subcategoria.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "categoryId": "uuid",
  "name": "Supermercado",
  "description": "Compras recorrentes de mercado", // opcional
  "color": "#EF4444" // opcional
}
```

**Response 201:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "categoryId": "uuid",
  "name": "Supermercado",
  "description": "Compras recorrentes de mercado",
  "color": "#EF4444",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `400` - Validação falhou
- `403` - Categoria não pertence ao usuário
- `404` - Categoria não encontrada

---

### GET `/categories/:id/subcategories`

Lista subcategorias de uma categoria.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "categoryId": "uuid",
    "name": "Supermercado",
    "description": "Compras recorrentes de mercado",
    "color": "#EF4444",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

---

### GET `/subcategories/:id`

Obtém uma subcategoria específica.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "categoryId": "uuid",
  "name": "Supermercado",
  "description": "Compras recorrentes de mercado",
  "color": "#EF4444",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `403` - Subcategoria não pertence ao usuário
- `404` - Subcategoria não encontrada

---

### PUT `/subcategories/:id`

Atualiza uma subcategoria.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "name": "Supermercado e Padaria", // opcional
  "description": "Compras da semana e padaria", // opcional
  "color": "#F59E0B" // opcional
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "categoryId": "uuid",
  "name": "Supermercado e Padaria",
  "description": "Compras da semana e padaria",
  "color": "#F59E0B",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros:**

- `403` - Subcategoria não pertence ao usuário
- `404` - Subcategoria não encontrada

---

### DELETE `/subcategories/:id`

Deleta uma subcategoria.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "message": "Subcategoria removida com sucesso."
}
```

**Erros:**

- `403` - Subcategoria não pertence ao usuário
- `404` - Subcategoria não encontrada
- `409` - Subcategoria com recorrência ativa vinculada não pode ser removida

---

## 💸 Transactions

### POST `/transactions`

Cria uma nova transação.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "accountId": "uuid",
  "categoryId": "uuid",
  "subcategoryId": "uuid", // opcional
  "type": "expense",
  "amount": 150.5,
  "date": "2025-01-15",
  "description": "Compra no supermercado", // opcional
  "notes": "Notas adicionais", // opcional
  "recurrence": {
    "postingMode": "review_required",
    "frequency": "monthly",
    "startDate": "2025-01-15", // opcional (default = date da transação)
    "dayOfMonth": 15,
    "endType": "never",
    "notes": "Recorrência mensal"
  }
}
```

**Tipos:**

- `income` - Receita
- `expense` - Despesa

**Response 201:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "accountId": "uuid",
  "categoryId": "uuid",
  "subcategoryId": "uuid",
  "type": "expense",
  "amount": 150.5,
  "date": "2025-01-15",
  "description": "Compra no supermercado",
  "notes": "Notas adicionais",
  "recurrenceId": "uuid",
  "transferId": null,
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `400` - Validação falhou
- `403` - Conta/categoria não pertence ao usuário
- `404` - Conta/categoria não encontrada
- `409` - Subcategoria não pertence à categoria

---

### GET `/transactions`

Lista transações com filtros e paginação.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 10, max: 100)
- `startDate` (string, formato: YYYY-MM-DD) - opcional
- `endDate` (string, formato: YYYY-MM-DD) - opcional
- `accountId` (uuid) - opcional
- `categoryId` (uuid) - opcional
- `subcategoryId` (uuid) - opcional
- `type` ("income" | "expense") - opcional
- `amount` (number) - opcional
- `amountOp` ("gt" | "gte" | "lt" | "lte") - opcional (requer `amount`)
- `amountMin` (number) - opcional
- `amountMax` (number) - opcional
- `description` (string, busca parcial) - opcional
- `notes` (string, busca parcial) - opcional
  - Quando `description` e `notes` são informados, a API faz busca **OR** entre os dois campos.
  - Observação: a busca por `description` e `notes` é insensível a acento (requer extensão `unaccent` no Postgres)

**Exemplo:**

```
GET /transactions?page=1&limit=20&startDate=2025-01-01&endDate=2025-01-31&type=expense&description=mercado&notes=extra
```

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "accountId": "uuid",
      "accountName": "Conta Corrente",
      "categoryId": "uuid",
      "categoryName": "Alimentacao",
      "subcategoryId": "uuid",
      "subcategoryName": "Supermercado",
      "type": "expense",
      "amount": 150.5,
      "date": "2025-01-15",
      "description": "Compra no supermercado",
      "notes": null,
      "transferId": null,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

**Notas:**

- `accountName`, `categoryName` e `subcategoryName` sao retornados via join.
- `subcategoryName` pode ser `null` quando a transacao nao tiver subcategoria.
- `amountMin` e `amountMax` devem ser enviados juntos e são inclusivos.

---

### GET `/transactions/:id`

Obtém uma transação específica.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "accountId": "uuid",
  "categoryId": "uuid",
  "subcategoryId": "uuid",
  "type": "expense",
  "amount": 150.5,
  "date": "2025-01-15",
  "description": "Compra no supermercado",
  "notes": null,
  "transferId": null,
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `403` - Transação não pertence ao usuário
- `404` - Transação não encontrada

---

### PUT `/transactions/:id`

Atualiza uma transação.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "accountId": "uuid", // opcional
  "categoryId": "uuid", // opcional
  "subcategoryId": "uuid", // opcional (pode ser null)
  "type": "expense", // opcional
  "amount": 200.0, // opcional
  "date": "2025-01-16", // opcional
  "description": "Nova descrição", // opcional
  "notes": "Novas notas" // opcional
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "accountId": "uuid",
  "categoryId": "uuid",
  "subcategoryId": "uuid",
  "type": "expense",
  "amount": 200.0,
  "date": "2025-01-16",
  "description": "Nova descrição",
  "notes": "Novas notas",
  "transferId": null,
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `400` - Validação falhou
- `403` - Transação não pertence ao usuário
- `404` - Transação não encontrada
- `409` - Subcategoria não pertence à categoria

**Notas:**

- Se a transação pertencer a uma transferência, a atualização aplica-se às duas transações vinculadas.
- Em transferências, não é permitido alterar categoria/tipo e as contas devem permanecer diferentes.

---

### DELETE `/transactions/:id`

Deleta uma transação.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "message": "Transação removida com sucesso."
}
```

**Notas:**

- Se a transação pertencer a uma transferência, as duas transações serão removidas.
- Mensagem pode retornar "Transferência removida com sucesso." quando aplicável.

**Erros:**

- `403` - Transação não pertence ao usuário
- `404` - Transação não encontrada

---

### GET `/transactions/summary`

Retorna resumo de receitas e despesas.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**

- `startDate` (string, formato: YYYY-MM-DD) - opcional
- `endDate` (string, formato: YYYY-MM-DD) - opcional
- `accountId` (uuid) - opcional
- `categoryId` (uuid) - opcional
- `subcategoryId` (uuid) - opcional
- `type` ("income" | "expense") - opcional

**Exemplo:**

```
GET /transactions/summary?startDate=2025-01-01&endDate=2025-01-31
```

**Response 200:**

```json
{
  "income": 5000.0,
  "expense": 3200.5,
  "balance": 1799.5
}
```

**Erros:**

- `403` - Conta não pertence ao usuário
- `404` - Conta não encontrada

---

### GET `/transactions/top-categories`

Retorna os 5 maiores gastos agrupados por categoria ou subcategoria.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**

- `startDate` (string, formato: YYYY-MM-DD) - opcional
- `endDate` (string, formato: YYYY-MM-DD) - opcional
- `accountId` (uuid) - opcional
- `type` ("income" | "expense") - opcional, default: `expense`
- `groupBy` ("category" | "subcategory") - opcional, default: `category`

**Exemplo:**

```
GET /transactions/top-categories?startDate=2025-01-01&endDate=2025-01-31
```

**Response 200:**

```json
[
  {
    "id": "uuid",
    "name": "Alimentação",
    "totalAmount": 1200.5,
    "percentage": 42.5
  }
]
```

**Erros:**

- `403` - Conta não pertence ao usuário
- `404` - Conta não encontrada

**Exemplo (groupBy=subcategory):**

```json
[
  {
    "id": "uuid-sub",
    "name": "Supermercado",
    "categoryId": "uuid-cat",
    "categoryName": "Alimentação",
    "totalAmount": 800.0,
    "percentage": 28.3
  }
]
```

**Notas:**

- Se `groupBy=subcategory`, inclui `categoryId` e `categoryName` no item.
- Retorna no máximo 5 itens, ordenados por maior gasto.
- O cálculo de `percentage` considera o total de despesas do período filtrado.

---

### GET `/transactions/descriptions`

Retorna descrições únicas usadas pelo usuário para autocomplete.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**

- `accountId` (uuid, obrigatório)
- `q` (string, opcional) - termo parcial
- `limit` (number, opcional, default: 5, max: 20)

**Exemplo:**

```
GET /transactions/descriptions?accountId=uuid&q=super&limit=5
```

**Response 200:**

```json
{
  "items": ["Ônibus", "Supermercado", "Academia"]
}
```

**Notas:**

- As descrições são únicas (case-insensitive) e ordenadas pela criação mais recente.

**Erros:**

- `400` - Validação falhou
- `403` - Conta não pertence ao usuário
- `404` - Conta não encontrada

---

## 🔄 Transfers

### POST `/transfers`

Cria uma transferência entre contas.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "fromAccountId": "uuid",
  "toAccountId": "uuid",
  "amount": 500.0,
  "date": "2025-01-15",
  "description": "Transferência para poupança", // opcional
  "recurrence": {
    "postingMode": "automatic",
    "frequency": "monthly",
    "startDate": "2025-01-15", // opcional (default = date da transferência)
    "dayOfMonth": 15,
    "endType": "never",
    "notes": "Recorrência mensal da transferência"
  }
}
```

**Validações:**

- `fromAccountId` e `toAccountId` devem ser diferentes
- Ambas as contas devem pertencer ao usuário
- `amount` deve ser maior que zero
- `date` deve estar no formato YYYY-MM-DD

**Response 201:**

```json
{
  "id": "uuid-transfer-id",
  "recurrenceId": "uuid",
  "fromAccount": {
    "id": "uuid",
    "userId": "uuid",
    "accountId": "uuid-from",
    "categoryId": "uuid-transfer-category",
    "type": "expense",
    "amount": 500.0,
    "date": "2025-01-15",
    "description": "Transferência para poupança",
    "transferId": "uuid-transfer-id",
    "createdAt": "2025-01-15T10:30:00.000Z"
  },
  "toAccount": {
    "id": "uuid",
    "userId": "uuid",
    "accountId": "uuid-to",
    "categoryId": "uuid-transfer-category",
    "type": "income",
    "amount": 500.0,
    "date": "2025-01-15",
    "description": "Transferência para poupança",
    "transferId": "uuid-transfer-id",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Nota:** Uma transferência cria automaticamente duas transações:

- **Débito (expense)** na conta de origem
- **Crédito (income)** na conta de destino
- Ambas usam a categoria de sistema "Transferência"
- Ambas são vinculadas pelo mesmo `transferId`

**Erros:**

- `400` - Validação falhou (contas iguais, valor inválido, etc.)
- `403` - Conta não pertence ao usuário
- `404` - Conta não encontrada ou categoria de sistema "Transferência" não existe

---

## 🔁 Recurrences

### POST `/recurrences`

Cria uma recorrência de transação ou transferência.

**Headers:** `Authorization: Bearer {token}`

**Campos relevantes:**

- `postingMode` é opcional e defaulta para `automatic`
- `review_required` gera pendências no job ao invés de lançamento automático

**Request Body (exemplo - transação):**

```json
{
  "originType": "transaction",
  "postingMode": "review_required",
  "frequency": "monthly",
  "startDate": "2026-04-10",
  "dayOfMonth": 10,
  "endType": "never",
  "accountId": "uuid",
  "categoryId": "uuid",
  "subcategoryId": "uuid",
  "amount": 350,
  "description": "Plano de celular",
  "notes": "Despesa recorrente"
}
```

**Request Body (exemplo - transferência):**

```json
{
  "originType": "transfer",
  "postingMode": "automatic",
  "frequency": "weekly",
  "startDate": "2026-04-10",
  "dayOfWeek": 5,
  "endType": "until_date",
  "endDate": "2026-12-31",
  "fromAccountId": "uuid",
  "toAccountId": "uuid",
  "amount": 200,
  "description": "Transferência para reserva"
}
```

**Response 201:** objeto da recorrência criada, incluindo `postingMode`, `version`, `nextOccurrenceDate`, `lastMaterializedDate`, `finalizedAt`, `deletedAt`.

---

### GET `/recurrences`

Lista recorrências do usuário com paginação e filtros.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**

- `page` (default: `1`)
- `limit` (default: `20`, máximo `100`)
- `originType` (`transaction | transfer`)
- `status` (`active | finalized`)
- `frequency` (`weekly | biweekly | monthly | yearly`)
- `postingMode` (`automatic | review_required`)
- `accountId` (UUID)
- `q` (busca por descrição/notas)

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "pendingReviewCount": 2
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 0
}
```

Cada item de `data` também inclui os campos completos da recorrência e `pendingReviewCount` para exibição do badge de pendências.

---

### GET `/recurrences/:id`

Retorna uma recorrência específica do usuário.

**Headers:** `Authorization: Bearer {token}`

**Response 200:** objeto da recorrência, incluindo `postingMode`, `version` e campos de controle de próxima execução.

---

### PUT `/recurrences/:id`

Atualiza uma recorrência ativa.

**Headers:** `Authorization: Bearer {token}`

**Observações:**

- suporta controle de concorrência otimista via `expectedVersion`
- aceita atualização de `postingMode`
- o payload pode ser parcial, mas campos omitidos não recebem defaults de criação; por exemplo, omitir `endType` preserva o término atual da recorrência
- se `frequency` for enviado, os campos de agenda obrigatórios para a frequência também devem ser enviados (`dayOfWeek` para `weekly`/`biweekly`, `dayOfMonth` para `monthly`, `dayOfMonth` + `monthOfYear` para `yearly`)
- se `endType` for enviado, o campo complementar obrigatório também deve ser enviado (`endOccurrences` para `by_occurrences`, `endDate` para `until_date`); campos incompatíveis com o novo término são limpos pelo backend
- `subcategoryId: null` limpa a subcategoria da recorrência de transação

**Request Body (parcial):**

```json
{
  "postingMode": "review_required",
  "amount": 420,
  "notes": "Atualizado",
  "expectedVersion": 1
}
```

**Erros:**

- `400` - validação
- `409` - conflito de concorrência (`expectedVersion` divergente)

---

### PUT `/recurrences/:id/edit-scope`

Aplica edição por escopo em recorrência ativa:

- `all`: atualiza a regra inteira para próximas materializações
- `this_and_next`: encerra a regra atual na véspera da ocorrência alvo e cria uma nova regra a partir da data alvo
- `single`: atualiza somente a ocorrência materializada da data alvo (sem alterar a regra-mãe)

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "scope": "this_and_next",
  "occurrenceDate": "2026-06-10",
  "changes": {
    "postingMode": "automatic",
    "amount": 480,
    "notes": "Ajuste de ciclo",
    "expectedVersion": 3
  }
}
```

**Regras importantes:**

- `occurrenceDate` é obrigatório para `single` e `this_and_next`
- `single` exige ocorrência já materializada na data selecionada
- `single` não permite editar ocorrência materializada passada
- `single` não permite alterar agenda (`frequency`, `startDate`, `endType`, etc.)
- `postingMode` pode ser alterado em `all` e `this_and_next`; em `single`, o cliente não deve enviar campos de regra/agenda para não afetar a regra-mãe
- no fluxo de edição do frontend, `all` envia snapshot completo da regra, `this_and_next` envia snapshot da nova regra sem `startDate` (o início vem de `occurrenceDate`) e `single` envia apenas campos de negócio da ocorrência

**Erros:**

- `400` - validação de escopo/regra de edição
- `409` - conflito de concorrência (`expectedVersion` divergente)

---

### PUT `/recurrences/:id/finalize`

Finaliza uma recorrência ativa.

**Headers:** `Authorization: Bearer {token}`

**Response 200:** objeto da recorrência finalizada.

---

### DELETE `/recurrences/:id`

Exclusão lógica da recorrência (somente quando `finalized`).

**Headers:** `Authorization: Bearer {token}`

**Response 200:**

```json
{
  "message": "Recorrência removida com sucesso."
}
```

**Erros:**

- `400` - recorrência ativa (precisa finalizar antes)
- `404` - recorrência não encontrada

---

### POST `/recurrences/occurrences/:id/confirm`

Confirma uma ocorrência `pending_review` e cria a transação ou transferência correspondente.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "expectedVersion": 1,
  "occurrenceDate": "2026-04-10",
  "amount": 350,
  "description": "Plano de celular",
  "notes": "Ajuste manual",
  "accountId": "uuid",
  "categoryId": "uuid",
  "subcategoryId": "uuid"
}
```

**Regras importantes:**

- `expectedVersion` é obrigatório
- `occurrenceDate`, `amount`, `description`, `notes` e vínculos podem ser ajustados
- a ação é transacional; cria a movimentação ou falha inteira
- quando há ajustes em relação ao snapshot de revisão, o backend persiste `metadata.adjustments.fields` e `metadata.adjustments.adjustedAt`

**Erros:**

- `422` - `occurrenceDate` fora do range permitido para a recorrência
- `409` - pendência já processada por outra requisição
- `404` - pendência não encontrada

**Response 200:** ocorrência atualizada com `status = materialized`, `version` incrementada e `transactionId`/`transferId` preenchidos quando aplicável.

---

### POST `/recurrences/occurrences/:id/skip`

Marca uma ocorrência `pending_review` como ignorada.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "expectedVersion": 1,
  "reason": "Pagamento já realizado manualmente"
}
```

**Regras importantes:**

- `expectedVersion` é obrigatório
- `reason` é opcional
- `skip` consome a posição da série em `by_occurrences`
- o backend persiste `metadata.skipReason` e `metadata.skippedAt` quando aplicável

**Erros:**

- `409` - pendência já processada por outra requisição
- `404` - pendência não encontrada

**Response 200:** ocorrência atualizada com `status = skipped` e `metadata.skipReason` quando informado.

---

### POST `/recurrences/materialize`

Materializa ocorrências pendentes das recorrências ativas do usuário.

**Headers:** `Authorization: Bearer {token}`

**Request Body (opcional):**

```json
{
  "untilDate": "2026-12-31",
  "maxRecurrences": 200
}
```

Quando `untilDate` não é enviado, o backend usa a data atual no timezone da recorrência.
Quando `maxRecurrences` não é enviado, usa lote padrão de `200` (máximo `500`).

**Regras importantes:**

- `automatic` materializa diretamente
- `review_required` cria `pending_review`
- `pending_review`, `materialized` e `skipped` contam como consumidas em `by_occurrences`

**Response 200:**

```json
{
  "totalActiveRecurrences": 14,
  "processedRecurrences": 3,
  "truncatedByBatch": true,
  "remainingRecurrences": 11,
  "createdOccurrences": 5,
  "skippedOccurrences": 2,
  "createdTransactions": 3,
  "createdTransfers": 2,
  "finalizedRecurrences": 1,
  "failedRecurrences": 0
}
```

**Erros:**

- `400` - regra inválida para materialização
- `401` - não autenticado

---

### GET `/recurrences/:id/timeline`

Retorna a timeline de uma recorrência misturando ocorrências persistidas e projeções futuras.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**

- `limit` (default: `24`, máximo `120`)
- `untilDate` (YYYY-MM-DD, opcional)
- `includeProjected` (`true | false`, default: `true`)

**Regras importantes:**

- `sequence` conta a posição cronológica da série
- `canConfirm` e `canSkip` só vêm `true` para `pending_review` em recorrência ativa
- `projectionWindowLabel` indica janela parcial quando houver mais itens além do limite
- itens persistidos incluem `version` e `reviewPayload` para suportar confirmação e skip com lock otimista no frontend
- para itens `materialized` com `transactionId`, o campo `amount` reflete o valor **atual** da transação no banco — não o `reviewPayload`; se o usuário editou o valor da transação após a materialização, a timeline exibe o valor atualizado
- para transferências (`transferId != null`) o `amount` ainda vem do `reviewPayload` (comportamento mantido)

**Response 200 (exemplo):**

```json
{
  "recurrence": {
    "id": "uuid",
    "originType": "transaction",
    "postingMode": "review_required",
    "status": "active",
    "frequency": "monthly",
    "startDate": "2026-04-10",
    "nextOccurrenceDate": "2026-05-10",
    "version": 3
  },
  "summary": {
    "totalOccurrences": 12,
    "consumedOccurrences": 2,
    "materializedOccurrences": 1,
    "pendingReviewOccurrences": 1,
    "skippedOccurrences": 0,
    "failedOccurrences": 0,
    "projectedOccurrences": 2,
    "totalAmount": null,
    "materializedAmount": 350,
    "pendingReviewAmount": 350,
    "projectedAmount": 700,
    "appliedLimit": 24,
    "isPartial": true,
    "hasMoreProjected": true,
    "projectionWindowLabel": "Próximas 24 ocorrências"
  },
  "items": [
    {
      "id": "occ-1",
      "sequence": 1,
      "occurrenceDate": "2026-04-10",
      "status": "materialized",
      "source": "persisted",
      "amount": 350,
      "transactionId": "tx-1",
      "transferId": null,
      "version": 1,
      "reviewPayload": null,
      "canConfirm": false,
      "canSkip": false
    },
    {
      "id": "occ-2",
      "sequence": 2,
      "occurrenceDate": "2026-05-10",
      "status": "pending_review",
      "source": "persisted",
      "amount": 350,
      "transactionId": null,
      "transferId": null,
      "version": 7,
      "reviewPayload": {
        "occurrenceDate": "2026-05-10",
        "originalScheduledDate": "2026-05-10",
        "originType": "transaction",
        "amount": 350,
        "description": "Plano de celular",
        "notes": null,
        "accountId": "uuid",
        "categoryId": "uuid",
        "subcategoryId": null
      },
      "canConfirm": true,
      "canSkip": true
    },
    {
      "id": null,
      "sequence": 3,
      "occurrenceDate": "2026-06-10",
      "status": "projected",
      "source": "projected",
      "amount": 350,
      "transactionId": null,
      "transferId": null,
      "version": null,
      "reviewPayload": null,
      "canConfirm": false,
      "canSkip": false
    }
  ]
}
```

**Erros:**

- `403` - recorrência não pertence ao usuário
- `404` - recorrência não encontrada

---

### POST `/recurrences/:id/anticipate`

Cria e materializa imediatamente uma ocorrência projetada de uma recorrência ativa, sem aguardar o job diário.

**Headers:** `Authorization: Bearer {token}`

**Request body:**

```json
{
  "occurrenceDate": "2026-06-10",
  "amount": 350,
  "description": "Plano de celular",
  "notes": null,
  "accountId": "uuid",
  "categoryId": "uuid",
  "subcategoryId": null
}
```

Campos para transferência usam `fromAccountId` e `toAccountId` em vez de `accountId`/`categoryId`.

**Regras:**
- `occurrenceDate` obrigatório e deve corresponder a uma data válida da série
- Recorrência deve estar `active`
- Não pode existir ocorrência já registrada para a mesma data
- `by_occurrences`: rejeita se o limite de ocorrências já foi atingido
- Campos omitidos herdam o valor da regra-mãe

**Response 200:** shape idêntico ao `POST /recurrences/occurrences/:id/confirm` — ocorrência materializada com `transactionId`/`transferId` preenchidos.

**Erros:**

- `400` - payload inválido
- `401` - não autenticado
- `404` - recorrência não encontrada
- `409` - já existe ocorrência para a data informada
- `422` - data inválida na série, recorrência não ativa, ou limite de ocorrências atingido

---

### GET `/recurrences/forecast`

Retorna projeção de recorrências até o fim do ano, com separação explícita entre:

- `real` (já materializado em `transactions`)
- `projected` (futuro calculado sem materializar no banco)
- `combined` (`real + projected`)

**Headers:** `Authorization: Bearer {token}`

**Query Params:**

- `year` (opcional, default: ano atual no timezone do usuário)
- `accountIds` (opcional, UUIDs separados por vírgula)

**Regras importantes:**

- projeção nunca materializa transação no banco
- `pending_review` e `skipped` entram como consumidas para evitar duplicidade de projeção
- recorrência de transferência projeta duas pernas (`expense` origem + `income` destino), respeitando `accountIds`

**Response 200 (exemplo):**

```json
{
  "year": 2099,
  "timezone": "Australia/Adelaide",
  "accountIds": ["uuid-account-1"],
  "horizon": {
    "projectionStartDate": "2099-01-01",
    "projectionEndDate": "2099-12-31"
  },
  "totals": {
    "real": {
      "income": { "months": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "yearTotal": 0 },
      "expense": { "months": [40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "yearTotal": 40 },
      "balance": { "months": [-40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "yearTotal": -40 }
    },
    "projected": {
      "income": { "months": [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50], "yearTotal": 600 },
      "expense": {
        "months": [150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150],
        "yearTotal": 1800
      },
      "balance": {
        "months": [-100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100],
        "yearTotal": -1200
      }
    },
    "combined": {
      "income": { "months": [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50], "yearTotal": 600 },
      "expense": {
        "months": [190, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150],
        "yearTotal": 1840
      },
      "balance": {
        "months": [-140, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100],
        "yearTotal": -1240
      }
    }
  },
  "metadata": {
    "projectedOccurrences": 24
  }
}
```

**Erros:**

- `400` - query inválida (`year`, `accountIds`)
- `403` - conta informada não pertence ao usuário
- `401` - não autenticado

---

## 📊 Reports

### GET `/reports/weekly-cashflow`

Retorna visão semanal com colunas fixas (`total`, `received`, `spent`) e catálogo de colunas dinâmicas por categoria/subcategoria.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**

- `year` (obrigatório, number, ex.: `2026`)
- `weekStart` (opcional, `monday | sunday`, default: `monday`)
- `accountIds` (opcional, string com UUIDs separados por vírgula)
  - quando omitido, aplica conta principal por padrão

**Response 200:**

```json
{
  "year": 2026,
  "weekStart": "monday",
  "appliedAccountIds": ["acc-main", "acc-2"],
  "defaultAccountId": "acc-main",
  "summaryColumns": ["total", "received", "spent"],
  "columnsCatalog": [
    {
      "id": "subcat:sub-1",
      "label": "Mercado",
      "type": "expense",
      "scope": "subcategory",
      "categoryId": "cat-exp-1",
      "categoryName": "Casa",
      "subcategoryId": "sub-1",
      "subcategoryName": "Mercado"
    },
    {
      "id": "cat:cat-inc-1:no-subcategory",
      "label": "Renda Extra",
      "type": "income",
      "scope": "category",
      "categoryId": "cat-inc-1",
      "categoryName": "Renda Extra",
      "subcategoryId": null,
      "subcategoryName": null
    }
  ],
  "weeks": [
    {
      "week": 1,
      "startDate": "2025-12-29",
      "endDate": "2026-01-04",
      "total": 2200,
      "received": 2500,
      "spent": 300,
      "dynamicValues": {
        "subcat:sub-1": 300,
        "cat:cat-inc-1:no-subcategory": 2500
      }
    }
  ]
}
```

**Regras importantes:**

- `weeks` sempre retorna semanas normalizadas do ano selecionado, mesmo sem movimento.
- `dynamicValues` pode não conter algumas colunas em semanas sem valor; no frontend tratar como `0`.
- valores zerados devem ser renderizados como `-` no frontend.

**Erros:**

- `400` - Query inválida (`year`, `weekStart` ou `accountIds`)
- `401` - Não autenticado
- `403` - Conta informada não pertence ao usuário autenticado

---

### GET `/reports/consolidated/years`

Retorna a lista de anos que possuem movimentação para o usuário (ou para as contas filtradas).

**Headers:** `Authorization: Bearer {token}`

**Query Params:**

- `accountIds` (opcional, string com UUIDs separados por vírgula)
  - exemplo: `accountIds=id1,id2,id3`

**Response 200:**

```json
{
  "years": [2026, 2025, 2024]
}
```

**Erros:**

- `400` - Query inválida (`accountIds` inválidos)
- `401` - Não autenticado
- `403` - Conta informada não pertence ao usuário autenticado

---

### GET `/reports/consolidated`

Retorna o consolidado anual agrupado por `tipo > categoria > subcategoria`, com totais mensais e total anual.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**

- `year` (obrigatório, number, ex.: `2026`)
- `accountIds` (opcional, string com UUIDs separados por vírgula)
  - exemplo: `accountIds=id1,id2,id3`

**Response 200:**

```json
{
  "year": 2026,
  "accountIds": ["acc-1", "acc-2"],
  "income": [
    {
      "categoryId": "cat-1",
      "categoryName": "Receita Fixa",
      "months": [1000, 1000, 1000, 1000, 0, 0, 0, 0, 0, 0, 0, 0],
      "yearTotal": 4000,
      "subcategories": [
        {
          "subcategoryId": "sub-1",
          "subcategoryName": "Salário",
          "months": [1000, 1000, 1000, 1000, 0, 0, 0, 0, 0, 0, 0, 0],
          "yearTotal": 4000
        }
      ]
    }
  ],
  "expense": [
    {
      "categoryId": "cat-2",
      "categoryName": "Moradia",
      "months": [500, 500, 500, 500, 0, 0, 0, 0, 0, 0, 0, 0],
      "yearTotal": 2000,
      "subcategories": [
        {
          "subcategoryId": "sub-2",
          "subcategoryName": "Aluguel",
          "months": [500, 500, 500, 500, 0, 0, 0, 0, 0, 0, 0, 0],
          "yearTotal": 2000
        }
      ]
    }
  ],
  "totals": {
    "income": {
      "months": [1000, 1000, 1000, 1000, 0, 0, 0, 0, 0, 0, 0, 0],
      "yearTotal": 4000
    },
    "expense": {
      "months": [500, 500, 500, 500, 0, 0, 0, 0, 0, 0, 0, 0],
      "yearTotal": 2000
    }
  }
}
```

**Regras importantes:**

- Se `accountIds` não for enviado, considera todas as contas do usuário.
- Meses sem movimento retornam `0`.
- Categoria sem subcategoria aparece apenas no subtotal da categoria.

**Erros:**

- `400` - Query inválida (`year` fora do intervalo ou `accountIds` inválidos)
- `401` - Não autenticado
- `403` - Conta informada não pertence ao usuário autenticado

---

## 🧾 Audit

### GET `/audit-logs`

Lista logs de auditoria do usuário autenticado com filtros, paginação e modo de visualização.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**

- `page` (number, default: `1`)
- `limit` (number, `1..100`, default: `20`)
- `view` (`raw | grouped`, default: `raw`)
  - `raw`: retorna cada log individual
  - `grouped`: agrupa pares de transferência (`transfer-create`) em um único evento para listagem
- `entityType` (`transaction | account | category | subcategory | recurrence | recurrence_occurrence`)
- `action` (`create | update | delete | materialize_pending | confirm | skip | fail`)
- `startDate` (`YYYY-MM-DD`)
- `endDate` (`YYYY-MM-DD`)

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "entityType": "transaction",
      "entityId": "uuid",
      "action": "create",
      "beforeData": null,
      "afterData": {},
      "metadata": {},
      "summary": {
        "screen": "Transações",
        "action": "Criação",
        "description": "Transferência para poupança",
        "accountName": "Conta Corrente",
        "categoryName": "Transferência",
        "subcategoryName": null
      },
      "beforeDataFriendly": null,
      "afterDataFriendly": {
        "Descrição": "Transferência para poupança",
        "Valor": "R$ 200,00",
        "Tipo": "Despesa",
        "Conta": "Conta Corrente"
      },
      "metadataFriendly": {
        "Operação": "transfer-create",
        "Lado": "fromAccount",
        "Transferência": "uuid"
      },
      "createdAt": "2026-03-11T12:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 42
}
```

**Notas:**

- Prefira `view=grouped` na tela de histórico para reduzir ruído e custo de renderização.
- Use `summary` e os campos `*Friendly` para interface.
- Use `beforeData`, `afterData` e `metadata` para debug técnico quando necessário.

**Erros:**

- `400` - Query inválida (ex.: `limit > 100`, intervalo de datas inválido)
- `401` - Não autenticado

---

## 📝 Notas Importantes

### Formato de Datas

Todas as datas devem estar no formato **ISO 8601** (YYYY-MM-DD):

- ✅ `"2025-01-15"`
- ❌ `"15/01/2025"`
- ❌ `"2025-1-15"`

### Formato de Valores Monetários

Valores monetários são enviados como **números** (não strings):

- ✅ `150.50`
- ❌ `"150.50"`

### UUIDs

Todos os IDs são **UUIDs** no formato:

- `"550e8400-e29b-41d4-a716-446655440000"`

### Paginação

Quando aplicável, a paginação retorna:

- `data`: Array de resultados
- `page`: Página atual
- `limit`: Itens por página
- `total`: Total de itens

### Categorias de Sistema

Categorias de sistema têm:

- `userId: null`
- `system: true`
- Não podem ser editadas ou deletadas pelo usuário
- Exemplo: "Transferência"

### Saldo de Contas

O saldo de uma conta é calculado como:

```
saldo = soma(transactions.amount)
```

Onde:

- `income` adiciona ao saldo
- `expense` subtrai do saldo

---

## 🔄 Exemplo de Fluxo Completo

### 1. Registro e Login

```typescript
// 1. Registrar
const registerRes = await fetch("/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "João Silva",
    email: "joao@example.com",
    password: "MinhaSenh@123",
    confirmPassword: "MinhaSenh@123",
  }),
});
const { accessToken } = await registerRes.json();

// 2. Armazenar token
localStorage.setItem("accessToken", accessToken);
```

### 2. Criar Conta

```typescript
const accountRes = await fetch("/accounts", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    name: "Conta Corrente",
    type: "checking_account",
  }),
});
const account = await accountRes.json();
```

### 3. Criar Categoria

```typescript
const categoryRes = await fetch("/categories", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    name: "Alimentação",
    type: "expense",
  }),
});
const category = await categoryRes.json();
```

### 4. Criar Transação

```typescript
const transactionRes = await fetch("/transactions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    accountId: account.id,
    categoryId: category.id,
    type: "expense",
    amount: 150.5,
    date: "2025-01-15",
    description: "Compra no supermercado",
  }),
});
const transaction = await transactionRes.json();
```

### 5. Listar Transações com Filtros

```typescript
const listRes = await fetch(
  "/transactions?page=1&limit=20&startDate=2025-01-01&endDate=2025-01-31&type=expense",
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  },
);
const { data, page, limit, total } = await listRes.json();
```

### 6. Renovar Token

```typescript
// Quando receber 401, tentar renovar
const refreshRes = await fetch("/auth/refresh", {
  method: "POST",
  credentials: "include", // importante para enviar cookie
});
const { accessToken: newToken } = await refreshRes.json();
localStorage.setItem("accessToken", newToken);
```

---

## 🛠️ Tratamento de Erros

### Exemplo de Tratamento

```typescript
async function apiCall(url: string, options: RequestInit) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      // Tentar renovar token
      const refreshRes = await fetch("/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (refreshRes.ok) {
        const { accessToken } = await refreshRes.json();
        setToken(accessToken);
        // Retry a requisição original
        return apiCall(url, options);
      } else {
        // Redirecionar para login
        redirectToLogin();
        return;
      }
    }

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || error.title);
    }

    return await res.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
```

---

## 📌 Checklist de Implementação

- [ ] Configurar base URL (dev/prod)
- [ ] Implementar armazenamento de access token
- [ ] Implementar renovação automática de token
- [ ] Implementar tratamento de erros 401/403/404
- [ ] Configurar CORS (se necessário)
- [ ] Implementar interceptors para adicionar token
- [ ] Implementar refresh automático antes de expirar
- [ ] Tratar erros RFC 7807
- [ ] Validar formatos (UUID, datas, valores)

---

**Última atualização:** Janeiro 2025  
**Versão da API:** 1.0.0
