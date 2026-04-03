#NÃO OPERACIONAL - Script para resetar o banco de dados remoto via SSH e aplicar migrations

#!/bin/bash
set -e

echo "📂 Carregando variáveis do .env..."
export $(grep -v '^#' .env | xargs)

# ---------- VALIDAÇÕES INICIAIS ----------
if [ -z "$SSH_HOST" ] || [ -z "$SSH_KEY" ] || [ -z "$SSH_CONTAINER_NAME" ] || [ -z "$SSH_POSTGRES_USER" ] || [ -z "$SSH_POSTGRES_DB" ]; then
  echo "❌ Erro: Variáveis SSH_HOST, SSH_KEY, SSH_CONTAINER_NAME, SSH_POSTGRES_USER ou SSH_POSTGRES_DB não definidas."
  exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
  echo "❌ Erro: Arquivo de chave SSH não encontrado: $SSH_KEY"
  exit 1
fi

echo "🔑 Usando chave SSH: $SSH_KEY"
echo "📡 Servidor: $SSH_HOST"
echo "🗄  Banco alvo: $SSH_POSTGRES_DB"
echo ""
echo "⚠️  *ATENÇÃO EXTREMA*"
echo "Esta operação irá:"
echo "  - APAGAR totalmente o schema PUBLIC do banco"
echo "  - REMOVER TODAS AS TABELAS"
echo "  - RODAR AS MIGRATIONS DO ZERO"
echo ""

# ---------- CONFIRMAÇÃO 1 ----------
echo "⚠️  CONFIRMAÇÃO 1 — Tem certeza que deseja continuar?"
read -p "Digite SIM para continuar: " CONFIRMAR
if [ "$CONFIRMAR" != "SIM" ]; then
  echo "❌ Cancelado."
  exit 1
fi

# ---------- CONFIRMAÇÃO 2 ----------
echo ""
echo "⚠️  CONFIRMAÇÃO 2 — Segurança Avançada"
echo "Para continuar, digite *exatamente* o nome do banco:"
echo "  👉 $SSH_POSTGRES_DB"
read -p "> " CONFIRMAR_DB

if [ "$CONFIRMAR_DB" != "$SSH_POSTGRES_DB" ]; then
  echo "❌ Nome do banco incorreto. Cancelado."
  exit 1
fi

# ---------- TESTAR CONEXÃO SSH ----------
echo ""
echo "🔗 Testando conexão SSH..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_HOST" "echo 'Conexão OK'" || {
  echo "❌ Falha ao conectar via SSH."
  exit 1
}

# ---------- VALIDAR SE CONTAINER EXISTE ----------
echo "🔍 Verificando container '$SSH_CONTAINER_NAME'..."
ssh -i "$SSH_KEY" "$SSH_HOST" "
  docker ps --format '{{.Names}}' | grep -w $SSH_CONTAINER_NAME > /dev/null
" || {
  echo "❌ Erro: Container '$SSH_CONTAINER_NAME' não encontrado."
  exit 1
}

# ---------- RESET DB ----------
echo ""
echo "🧹 Limpando schema public..."
ssh -i "$SSH_KEY" "$SSH_HOST" << EOF
docker exec $SSH_CONTAINER_NAME \
  psql -U $SSH_POSTGRES_USER -d $SSH_POSTGRES_DB -c "DROP SCHEMA public CASCADE;"

docker exec $SSH_CONTAINER_NAME \
  psql -U $SSH_POSTGRES_USER -d $SSH_POSTGRES_DB -c "CREATE SCHEMA public;"
EOF

echo "📦 Aplicando migrations..."
npm run db:migrate

echo ""
echo "✅ Banco resetado com sucesso e migrations aplicadas!"