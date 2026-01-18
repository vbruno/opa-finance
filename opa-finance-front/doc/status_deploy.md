# Status de Deploy (Frontend + Backend)

## Frontend

- Repo: opa-finance-front
- Build: Vite gera `dist/`
- Container: Nginx serve `dist/`
- `VITE_API_URL` no build: `/api`
- docker-compose do front: sem `ports`, exposto via Nginx Proxy Manager
- Redes externas usadas: `proxy-net` (publica) + `opa-finance-net` (privada)

## Backend

- Repo: opa-finance-api
- Container name: `opa-finance-api`
- Porta interna: `3333`
- docker-compose do back: sem `ports`, acesso apenas interno
- Redes: `opa-finance-net` (comunicação interna)

## Nginx (frontend)

- Arquivo: `nginx.conf` no repo do front
- Regras:
  - `/api/` -> `http://opa-finance-api:3333/`
  - `/` -> SPA fallback `index.html`

## Situação atual

- Front e back estão na mesma rede Docker `opa-finance-net` (privada)
- Front também está na `proxy-net` (exposto via Nginx Proxy Manager)
- Browser chama `/api` no mesmo host do frontend
- Nginx encaminha para o backend por hostname interno `opa-finance-api`
- Evita CORS e evita expor host interno no navegador

## Pendências

- Ajustar/revisar CORS no backend após estabilizar o proxy reverso.
- Confirmar se o proxy do Nginx precisa de headers extras (ex: `X-Forwarded-For`, `X-Forwarded-Proto`).
