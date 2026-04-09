# Opa Finance — Monorepo

**Opa Finance** é um sistema de controle financeiro pessoal para acompanhar receitas, despesas, categorias, contas e transferências, oferecendo visão clara do saldo e do resumo mensal.

Esse repositório é um monorepo composto por dois projetos principais:

- **Backend** (Fastify + TypeScript + Drizzle + PostgreSQL)
- **Frontend** (React + Vite + TypeScript + Tailwind)

## 📁 Estrutura do repositório

```
opa-finance/
├─ opa-finance-api/    # Backend
└─ opa-finance-front/  # Frontend
```

## ✅ Requisitos

- Node.js 18+
- npm 9+
- PostgreSQL **local ou remoto** **ou** Docker + Docker Compose (para subir o banco)

## 🚀 Como rodar (visão rápida)

### Backend

1. Instalar dependências
   - `cd opa-finance-api && npm install`
2. Configurar `.env`
   - Veja [opa-finance-api/README.md](opa-finance-api/README.md)
3. Rodar migrations
   - `npm run db:migrate`
4. Iniciar API
   - `npm run dev`

### Frontend

1. Instalar dependências
   - `cd opa-finance-front && npm install`
2. Definir variável de ambiente
   - `VITE_API_URL` (ex.: `http://localhost:3333`)
3. Iniciar app
   - `npm run dev`

## 🧩 Documentação

- Guia da documentacao raiz: [docs/README.md](docs/README.md)
- Contrato de versionamento: [docs/versionamento.md](docs/versionamento.md)
- Backend: [opa-finance-api/README.md](opa-finance-api/README.md)
- Frontend: [opa-finance-front/README.md](opa-finance-front/README.md)
- Guia do Frontend: [opa-finance-front/doc/FRONTEND_GUIDE.md](opa-finance-front/doc/FRONTEND_GUIDE.md)
- Regras de negócio (Front): [opa-finance-front/doc/FRONTEND_REGRAS_DE_NEGOCIO.md](opa-finance-front/doc/FRONTEND_REGRAS_DE_NEGOCIO.md)
- Documento consolidado do projeto: [opa-finance-api/docs/documento_consolidado_planejamento.md](opa-finance-api/docs/documento_consolidado_planejamento.md)
- Módulos do backend:
  - [Auth](opa-finance-api/docs/modules/modules_auth.md)
  - [Users](opa-finance-api/docs/modules/modules_users.md)
  - [Accounts](opa-finance-api/docs/modules/modules_accounts.md)
  - [Categories](opa-finance-api/docs/modules/modules_categories.md)
  - [Subcategories](opa-finance-api/docs/modules/modules_subcategories.md)
  - [Transactions](opa-finance-api/docs/modules/modules_transactions.md)
  - [Transfers](opa-finance-api/docs/modules/modules_transfers.md)
  - [Recurrences](opa-finance-api/docs/modules/modules_recurrences.md)
  - [Reports](opa-finance-api/docs/modules/modules_reports.md)
  - [Audit](opa-finance-api/docs/modules/modules_audit.md)

Materiais historicos e operacionais da raiz foram movidos para `docs-hidden/`.

## 🧪 Testes

### Backend

- `cd opa-finance-api`
- `npm run test`

## 🧰 Scripts úteis

### Backend

- `npm run dev` — servidor local
- `npm run db:migrate` — migrations

### Monorepo

- `./scripts/version-cycle.sh` — menu interativo para iniciar novo ciclo em `dev`, promover `dev` para `main` ou consultar a versao calculada atual

### Frontend

- `npm run dev` — servidor local
- `npm run build` — build de produção
- `npm run preview` — preview do build

## 🔐 Observações de segurança

- Tokens sensíveis devem ficar em variáveis de ambiente.
- Cookies httpOnly são usados para refresh token no backend.

## 📝 Notas

- Este README é o ponto de entrada do monorepo. Para detalhes técnicos e regras de negócio, consulte os links de documentação acima.

## 📄 Licença

MIT — consulte o arquivo [LICENSE](LICENSE).

## 👨‍💻 Autor

**Bruno S Velho**
- Email: bruno.velho@gmail.com
- GitHub: https://github.com/vbruno
- LinkedIn: https://www.linkedin.com/in/brunovelho/
