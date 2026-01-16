# Plano de Containerizacao do Backend

## Objetivo
Padronizar a execucao do backend em containers para desenvolvimento e producao, garantindo build reprodutivel, variaveis de ambiente consistentes e estrategia de migrations clara.

## Escopo
- Dockerfile (multi-stage)
- .dockerignore
- docker-compose para Postgres local
- Variaveis de ambiente
- Migrations
- Healthcheck e logs
- CI/CD basico (build e push)

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
- Usar `.env` local e `--env-file` no compose, sem embutir em imagem.

### 3) docker-compose (desenvolvimento)
- Subir Postgres local com volume persistente.
- Expor porta 5432.
- Definir `DATABASE_URL` apontando para o service do Postgres.
- (Opcional) adicionar Adminer/pgAdmin.

### 4) Migrations
- Definir quando rodar:
  - Manual: `npm run db:migrate`
  - CI/CD: etapa antes de subir app
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
