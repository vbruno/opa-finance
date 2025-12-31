# 📚 Referência da API — Frontend

Documentação completa da API para integração com o frontend.

---

## 📋 Índice

- [Configuração Base](#configuração-base)
- [Autenticação](#autenticação)
- [Estrutura de Erros](#estrutura-de-erros)
- [Endpoints](#endpoints)
  - [Auth](#auth)
  - [Users](#users)
  - [Accounts](#accounts)
  - [Categories](#categories)
  - [Subcategories](#subcategories)
  - [Transactions](#transactions)
  - [Transfers](#transfers)

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

## 🔑 Auth

### POST `/auth/register`

Registra um novo usuário.

**Request Body:**

```json
{
  "name": "João Silva",
  "email": "joao@example.com",
  "password": "MinhaSenh@123",
  "confirmPassword": "MinhaSenh@123"
}
```

**Validações:**

- `name`: mínimo 3 caracteres, máximo 255
- `email`: formato válido, máximo 255
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

Lista usuários (com paginação).

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 10)

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@example.com",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1
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
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `404` - Usuário não encontrado

---

### PUT `/users/:id`

Atualiza um usuário.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "name": "João Silva Santos" // opcional
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "name": "João Silva Santos",
  "email": "joao@example.com",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**

- `403` - Apenas o próprio usuário pode atualizar
- `404` - Usuário não encontrado

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
  "initialBalance": 1000,
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
  "initialBalance": 1000,
  "color": "#3B82F6",
  "icon": "wallet",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

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
    "initialBalance": 1000,
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
  "initialBalance": 1000,
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
  "initialBalance": 1500, // opcional
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
  "initialBalance": 1500,
  "color": "#10B981",
  "icon": "bank",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros:**

- `403` - Conta não pertence ao usuário
- `404` - Conta não encontrada

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

---

## 🗂 Categories

### POST `/categories`

Cria uma nova categoria.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**

```json
{
  "name": "Alimentação",
  "type": "expense"
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
  "name": "Alimentação",
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

**Response 200:**

```json
[
  {
    "id": "uuid",
    "userId": null, // null para categorias de sistema
    "name": "Transferência",
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
    "type": "expense",
    "system": false,
    "color": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

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
  "name": "Alimentação e Bebidas" // opcional
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Alimentação e Bebidas",
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
- `409` - Categoria possui transações e não pode ser removida

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
- `409` - Subcategoria possui transações e não pode ser removida

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
  "amount": 150.50,
  "date": "2025-01-15",
  "description": "Compra no supermercado", // opcional
  "notes": "Notas adicionais" // opcional
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
  "amount": 150.50,
  "date": "2025-01-15",
  "description": "Compra no supermercado",
  "notes": "Notas adicionais",
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
- `description` (string, busca parcial) - opcional
- `notes` (string, busca parcial) - opcional
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
      "amount": 150.50,
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
  "amount": 150.50,
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
  "amount": 200.00, // opcional
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
  "amount": 200.00,
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
  "income": 5000.00,
  "expense": 3200.50,
  "balance": 1799.50
}
```

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
  "amount": 500.00,
  "date": "2025-01-15",
  "description": "Transferência para poupança" // opcional
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
  "fromAccount": {
    "id": "uuid",
    "userId": "uuid",
    "accountId": "uuid-from",
    "categoryId": "uuid-transfer-category",
    "type": "expense",
    "amount": 500.00,
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
    "amount": 500.00,
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
saldo = initialBalance + soma(transactions.amount)
```

Onde:

- `income` adiciona ao saldo
- `expense` subtrai do saldo

---

## 🔄 Exemplo de Fluxo Completo

### 1. Registro e Login

```typescript
// 1. Registrar
const registerRes = await fetch('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'João Silva',
    email: 'joao@example.com',
    password: 'MinhaSenh@123',
    confirmPassword: 'MinhaSenh@123'
  })
});
const { accessToken } = await registerRes.json();

// 2. Armazenar token
localStorage.setItem('accessToken', accessToken);
```

### 2. Criar Conta

```typescript
const accountRes = await fetch('/accounts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    name: 'Conta Corrente',
    type: 'checking_account',
    initialBalance: 1000
  })
});
const account = await accountRes.json();
```

### 3. Criar Categoria

```typescript
const categoryRes = await fetch('/categories', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    name: 'Alimentação',
    type: 'expense'
  })
});
const category = await categoryRes.json();
```

### 4. Criar Transação

```typescript
const transactionRes = await fetch('/transactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    accountId: account.id,
    categoryId: category.id,
    type: 'expense',
    amount: 150.50,
    date: '2025-01-15',
    description: 'Compra no supermercado'
  })
});
const transaction = await transactionRes.json();
```

### 5. Listar Transações com Filtros

```typescript
const listRes = await fetch(
  '/transactions?page=1&limit=20&startDate=2025-01-01&endDate=2025-01-31&type=expense',
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);
const { data, page, limit, total } = await listRes.json();
```

### 6. Renovar Token

```typescript
// Quando receber 401, tentar renovar
const refreshRes = await fetch('/auth/refresh', {
  method: 'POST',
  credentials: 'include' // importante para enviar cookie
});
const { accessToken: newToken } = await refreshRes.json();
localStorage.setItem('accessToken', newToken);
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
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
        ...options.headers
      }
    });

    if (res.status === 401) {
      // Tentar renovar token
      const refreshRes = await fetch('/auth/refresh', {
        method: 'POST',
        credentials: 'include'
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
    console.error('API Error:', error);
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
