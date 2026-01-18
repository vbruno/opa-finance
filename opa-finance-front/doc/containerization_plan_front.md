# Plano de Containerizacao do Frontend

## Objetivo

Padronizar a execucao do frontend em containers na VPS com Portainer, com build via Docker Compose, variaveis de ambiente no build e entrega via Nginx (SPA).

## Escopo

- Dockerfile (multi-stage)
- .dockerignore
- docker-compose para Portainer (build do repo)
- Variaveis de ambiente (build-time)
- Nginx para servir arquivos estaticos + fallback SPA
- Healthcheck e logs

## Plano

### 1) Dockerfile e .dockerignore

- Manter Dockerfile multi-stage:
  - `deps`: instala dependencias
  - `build`: executa `npm run build`
  - `runner`: Nginx servindo `dist/`
- Garantir fallback SPA no Nginx (todas as rotas -> `index.html`).
- .dockerignore deve excluir `node_modules`, `dist`, `.env`, `.git`.

### 2) Variaveis de ambiente (build-time)

- `VITE_API_URL` precisa estar definido no build.
- Quando usar reverse proxy no Nginx (mesmo dominio), definir `VITE_API_URL=/api`.
- Definir via `.env.production` ou `build args` no Portainer.
- Exemplo em `.env.example` (sem segredos).
- Observacao: Vite injeta variaveis no build; nao e runtime por padrao.

### 3) docker-compose (Portainer)

- Build direto do repo no Portainer (Stack).
- Usar redes externas:
  - `proxy-net` (publica, para o Nginx Proxy Manager)
  - `opa-finance-net` (privada, para comunicacao com o backend)
- Expor porta `80` (ou 8080) para o reverse proxy.
- Exemplo (ajustar caminho do compose):

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VITE_API_URL: "/api"
    restart: unless-stopped
    networks:
      - proxy-net
      - opa-finance-net

networks:
  proxy-net:
    external: true
  opa-finance-net:
    external: true
```

### 3.1) Passo a passo no Portainer (Stack)

1. Acesse **Stacks** > **Add stack**.
2. Escolha o metodo **Git repository**.
3. Informe o repo do frontend e branch `main`.
4. Ajuste o caminho do compose para `opa-finance-front/docker-compose.yml`.
5. Configure `VITE_API_URL` como build arg.
6. Deploy da stack.

### 4) Nginx (SPA)

- Criar `nginx.conf` com fallback:

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://opa-finance-api:3333/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### 5) Healthcheck

- Endpoint estatico: `GET /` retorna `index.html`.
- Healthcheck no Dockerfile (opcional):
  - `HEALTHCHECK CMD wget --spider -q http://localhost/ || exit 1`

### 6) Logs

- Acesso e erros via logs do Nginx.
- Em producao, manter logs com rotacao no host.

### 7) CI/CD (basico)

- Build da imagem com tag por commit.
- Push para registry (Docker Hub, GHCR, etc.).
- Deploy no host com compose ou orchestrator.

## Proximos passos sugeridos

1. Criar `Dockerfile`, `nginx.conf` e `.dockerignore` no frontend.
2. Criar `docker-compose.yml` e documentar no README.
3. Garantir `VITE_API_URL` correto no build de producao.
