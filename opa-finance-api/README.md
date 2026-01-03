
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
- [Instalação e Execução](#instalação-e-execução)
- [Scripts](#scripts)
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

### 🔄 Transfers
- Transferência entre contas
- Validação de acesso às contas
- Operação atômica

---

## 📦 Instalação e Execução

### 1️⃣ Clonar repositório
```sh
git clone https://github.com/SEU_USUARIO/NOME_DO_REPO.git
cd backend
```

### 2️⃣ Instalar dependências
```sh
npm install
```

### 3️⃣ Configurar ambiente  
Crie o arquivo `.env`:

```
DATABASE_URL="postgres://user:pass@localhost:5432/finance"
JWT_SECRET="sua_chave_segura"
REFRESH_TOKEN_SECRET="outra_chave_segura"
```

### 4️⃣ Rodar migrations
```sh
npm run db:migrate
```

### 5️⃣ Rodar servidor
```sh
npm run dev
```

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

## 🧪 Testes

Ferramentas:
- Vitest  
- fastify.inject  
- SQLite para testes  

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
Projeto desenvolvido por **Bruno Velho**.
