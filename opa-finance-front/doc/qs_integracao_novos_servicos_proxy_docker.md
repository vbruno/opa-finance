⚡ Quick Start — Integração de Novos Serviços

Guia rápido (1 página) para integrar qualquer novo serviço à infraestrutura padrão Docker + Nginx Proxy Manager.

Use este documento sempre que subir um novo frontend, API ou sistema.

⸻

🧠 Modelo Mental (30 segundos)
• 1 rede pública → proxy-net
• Redes privadas → apenas para API ↔ Banco
• Proxy expõe, API conecta, Banco isola

Internet → Nginx Proxy Manager → Serviço

⸻

🧱 Passo 0 — Pré-requisitos
• Docker rodando
• Nginx Proxy Manager já ativo
• Rede proxy-net criada

docker network ls | grep proxy-net

⸻

🌐 Passo 1 — Conectar o Serviço à Rede Pública

Todo serviço que será acessado por domínio DEVE estar na proxy-net.

Exemplo (Frontend ou API):

networks:

- proxy-net

networks:
proxy-net:
external: true

⸻

🔐 (Opcional) Passo 2 — Criar Rede Privada do Sistema

Usado quando há API + Banco.

networks:
system-internal:
driver: bridge

• API → proxy-net + system-internal
• Banco → apenas system-internal

⸻

⚙️ Passo 3 — Subir o Serviço
• Deploy via Portainer ou docker compose up -d
• Confirme que o container está Running

docker ps

⸻

🌍 Passo 4 — Criar Proxy no Nginx Proxy Manager

Frontend
• Domain: app.seudominio.com
• Scheme: http
• Forward Host: nome-do-container
• Port: 80

API
• Domain: api.seudominio.com
• Scheme: http
• Forward Host: nome-do-container
• Port: porta-da-api

⚠️ Sempre use hostname Docker, nunca IP.

⸻

🧪 Passo 5 — Testar HTTP (OBRIGATÓRIO)

curl -I <http://app.seudominio.com>

✔️ Esperado: 200 OK

❌ Se der 502, não siga — verifique rede e nome do container.

⸻

🔒 Passo 6 — Ativar SSL

No proxy criado:
• Request new certificate
• Force SSL
• ❌ HTTP/2 (primeiro teste)
• ❌ HSTS

Salvar e aguardar.

⸻

✅ Passo 7 — Teste Final

curl -kIv <https://app.seudominio.com>

✔️ Esperado:
• Certificado válido
• 200 OK

⸻

🚫 Erros Comuns (NÃO FAZER)
• ❌ Usar IP no proxy
• ❌ Criar SSL antes de testar HTTP
• ❌ Colocar banco na proxy-net
• ❌ Criar várias redes públicas
• ❌ Apagar arquivos manualmente no NPM

⸻

🧠 Regra de Ouro

Se o proxy não enxerga o container pelo nome, vai dar 502.

Conecte à rede certa e tudo funciona.

⸻

📌 Documento rápido de referência — OpaDev Infra Quick Start
