# Plano de Containerizacao do Backend

## Objetivo
Padronizar a execucao do backend em containers na VPS com Portainer, com build via Docker Compose, variaveis de ambiente via `env_file` e estrategia de migrations clara.

## Escopo
- Dockerfile (multi-stage)
- .dockerignore
- docker-compose para Portainer (build do repo)
- Variaveis de ambiente via `env_file`
- Migrations
- Healthcheck e logs

## Plano

### 1) Dockerfile e .dockerignore
- Manter Dockerfile multi-stage:
  - `deps`: instala dependencias
  - `build`: compila TypeScript
  - `runner`: executa `node dist/server.js`
- Garantir `HOST=0.0.0.0` e `PORT=3333` no runtime.
- .dockerignore deve excluir `node_modules`, `test`, `.env`, `.git`.

### 2) Variaveis de ambiente
- Definir e documentar:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `REFRESH_TOKEN_SECRET`
  - `LOG_LEVEL`
  - `CORS_ORIGINS`
  - `PORT`
  - `HOST`
- Definir variaveis direto no Stack do Portainer (sem `env_file`).
- Exemplo em `.env.example` (sem segredos reais).
- `CORS_ORIGINS=*` pode ser usado temporariamente ate o front estar publicado.

### 3) docker-compose (Portainer)
- Build direto do repo no Portainer (Stack).
- Usar rede externa `backend_net`.
- `DATABASE_URL` aponta para o container `postgres_infra`.
- Porta `3333` exposta para o Nginx.
- Healthcheck via `node -e` (sem dependencia de `wget`/`curl`).
- O frontend fica em outra subpasta do repo e nao participa do build do backend.

### 3.1) Passo a passo no Portainer (Stack)
1. Acesse **Stacks** > **Add stack**.
2. Escolha o metodo **Git repository**.
3. Informe o repo: `https://github.com/vbruno/opa-finance.git` e branch `main`.
4. Ajuste o caminho do compose para `opa-finance-api/docker-compose.yml`.
5. Configure as variaveis de ambiente direto na tela do Stack.
6. Deploy da stack.

### 4) Migrations
- Temporario: rodar `npm run db:migrate -- --config drizzle.config.ts` no start da API.
- Depois do primeiro deploy, voltar para o service dedicado `migrate`.
- Nao rodar `db:generate` em producao; gerar migrations em dev/CI.
- Garantir que migrations estao dentro do container (`src/db/migrations`).

### 5) Healthcheck
- Endpoint `/health` retorna `{ status: "ok" }`.
- Pode ser usado para readiness/liveness.
- Adicionar `HEALTHCHECK` no Dockerfile (opcional).

### 6) Logs
- Produção com `LOG_LEVEL` configuravel.
- Manter `logger` ativo apenas em `NODE_ENV=production`.

### 7) CI/CD (basico)
- Build da imagem com tag por commit.
- Push para registry (Docker Hub, GHCR, etc.).
- Deploy no host com compose ou orchestrator.

## Proximos passos sugeridos
1. Criar `docker-compose.yml` (Postgres + API).
2. Adicionar `/health` no Fastify.
3. Documentar comandos de build e run no README.
