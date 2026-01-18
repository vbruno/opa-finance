📦 Padrão de Infraestrutura Docker + Nginx Proxy Manager

Documentação de referência para integração de novos serviços usando Docker, Portainer e Nginx Proxy Manager, adotando o modelo Gateway + Redes Internas.

Este padrão foi definido para evitar erros comuns (502, SSL quebrado, DNS confuso) e garantir escalabilidade, segurança e previsibilidade.

⸻

🎯 Objetivo do Padrão
 • Usar 1 única rede pública (gateway) para entrada HTTP/HTTPS
 • Usar redes privadas por sistema para comunicação interna (API ↔ DB)
 • Centralizar SSL, DNS e exposição pública no Nginx Proxy Manager
 • Evitar IP fixo, evitando problemas em rede Docker

⸻

🧠 Conceito Central

🔹 Rede Gateway (Pública)

Nome padrão:

proxy-net

Responsabilidade:
 • Receber tráfego externo (HTTP / HTTPS)
 • Permitir comunicação do proxy com frontends e APIs

Containers que DEVEM estar nessa rede:
 • nginx-proxy-manager
 • frontends
 • APIs expostas

⸻

🔹 Redes Internas (Privadas)

Uma por sistema (opcional, mas recomendado).

Exemplos:

opa-finance-internal
opa-auth-internal
opa-blog-internal

Responsabilidade:
 • Comunicação interna entre API e banco
 • Não exposta à internet
 • Não acessível pelo proxy

Containers típicos:
 • API
 • Banco de dados

⸻

🗺️ Visão Geral da Arquitetura

Internet
   │
   ▼
Nginx Proxy Manager (proxy-net)
   │
   ├── Frontend (proxy-net)
   │
   └── API (proxy-net + internal-net)
           │
           └── Banco (internal-net)

⸻

🛠️ Pré-requisitos
 • Docker instalado
 • Portainer (opcional, mas recomendado)
 • Domínio configurado apontando para o IP da VPS
 • DNS tipo A ou wildcard funcionando

⸻

🧱 1. Criar a Rede Gateway (uma única vez)

docker network create proxy-net

Verificar:

docker network ls

⸻

🌐 2. Nginx Proxy Manager (Stack Padrão)

version: "3.9"

services:
  nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "81:81"
      - "443:443"
    volumes:
      - nginx_proxy_manager_data:/data
      - nginx_proxy_manager_letsencrypt:/etc/letsencrypt
    networks:
      - proxy-net

volumes:
  nginx_proxy_manager_data:
  nginx_proxy_manager_letsencrypt:

networks:
  proxy-net:
    external: true

⚠️ Nunca colocar o NPM em redes internas.

⸻

🎨 3. Frontend (Exemplo)

services:
  opa-finance-frontend:
    image: opa-finance-frontend:latest
    container_name: opa-finance-frontend
    networks:
      - proxy-net

networks:
  proxy-net:
    external: true

⸻

⚙️ 4. API + Banco (Exemplo)

API

services:
  opa-finance-api:
    image: opa-finance-api:latest
    container_name: opa-finance-api
    networks:
      - proxy-net
      - opa-finance-internal

Banco

services:
  finance-db:
    image: postgres:16
    container_name: finance-db
    environment:
      POSTGRES_DB: finance
      POSTGRES_USER: finance
      POSTGRES_PASSWORD: secret
    networks:
      - opa-finance-internal

Networks

networks:
  proxy-net:
    external: true
  opa-finance-internal:
    driver: bridge

⸻

🌍 5. Configuração no Nginx Proxy Manager

Frontend
 • Domain: finance.opadev.com
 • Scheme: http
 • Forward Hostname: opa-finance-frontend
 • Port: 80

API
 • Domain: api.finance.opadev.com
 • Scheme: http
 • Forward Hostname: opa-finance-api
 • Port: 3333

⚠️ Sempre testar HTTP antes de ativar SSL.

⸻

🔐 6. SSL (Regras)
 • Solicitar SSL somente após HTTP funcionar
 • Não usar IP no proxy
 • Não usar custom nginx inicialmente
 • HSTS somente após estabilidade

⸻

🚫 Erros Comuns (Evitar)
 • Criar uma rede por serviço exposto
 • Usar IP fixo no proxy
 • Colocar banco na rede pública
 • Apagar arquivos manualmente em /data/nginx
 • Criar SSL antes de validar HTTP

⸻

✅ Checklist para Novo Serviço
 • Serviço conectado à proxy-net
 • (Opcional) Rede interna criada
 • API conecta proxy-net + internal-net
 • Banco conecta apenas internal-net
 • Proxy criado usando hostname Docker
 • HTTP testado
 • SSL ativado

⸻

🧠 Regra de Ouro

Proxy é gateway.
API faz a ponte.
Banco nunca aparece para fora.

Seguindo esse padrão, a infraestrutura permanece simples, segura e escalável.

⸻

📌 Documento de referência oficial — OpaDev Infra Pattern
