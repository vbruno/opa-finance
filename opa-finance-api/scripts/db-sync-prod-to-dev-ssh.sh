#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
BACKUP_DIR="$PROJECT_DIR/backups"
SANITIZE_SQL="$(cd "$(dirname "$0")" && pwd)/db-sanitize-dev.sql"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Erro: arquivo .env nao encontrado em $ENV_FILE"
  exit 1
fi

echo "📂 Carregando variáveis do .env..."
set -a
. "$ENV_FILE"
set +a

SSH_KEY_PATH="${SSH_KEY/#\~/$HOME}"

REQUIRED_VARS=(
  "SSH_HOST"
  "SSH_KEY"
  "SSH_CONTAINER_NAME"
  "SSH_POSTGRES_USER"
  "SSH_POSTGRES_DB"
  "SSH_POSTGRES_DEV_DB"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Erro: Variável obrigatória não definida: $var"
    exit 1
  fi
done

if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "❌ Erro: Chave SSH não encontrada: $SSH_KEY_PATH"
  exit 1
fi

if [ ! -f "$SANITIZE_SQL" ]; then
  echo "❌ Erro: Arquivo de sanitização não encontrado: $SANITIZE_SQL"
  exit 1
fi

if [ "$SSH_POSTGRES_DB" = "$SSH_POSTGRES_DEV_DB" ]; then
  echo "❌ Erro: banco de produção e dev não podem ser o mesmo."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

confirmar_letra() {
  local input="$1"
  local first_char="$(echo "$input" | cut -c1 | tr '[:upper:]' '[:lower:]')"
  [ "$first_char" = "s" ]
}

gerar_codigo_confirmacao() {
  local letra numeros
  letra="$(LC_ALL=C tr -dc 'A-Z' </dev/urandom | head -c 1)"
  numeros="$(LC_ALL=C tr -dc '0-9' </dev/urandom | head -c 3)"
  printf "%s%s" "$letra" "$numeros"
}

testar_conexao() {
  echo "🔗 Testando conexão SSH..."
  ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$SSH_HOST" "echo 'Conexão OK'" || {
    echo "❌ Falha ao conectar via SSH."
    exit 1
  }
}

validar_container() {
  echo "🔍 Verificando container '$SSH_CONTAINER_NAME'..."
  ssh -i "$SSH_KEY_PATH" "$SSH_HOST" "
    docker ps --format '{{.Names}}' | grep -w $SSH_CONTAINER_NAME >/dev/null
  " || {
    echo "❌ Erro: Container '$SSH_CONTAINER_NAME' não encontrado."
    exit 1
  }
}

validar_banco_existe() {
  local DB_NAME="$1"

  ssh -i "$SSH_KEY_PATH" "$SSH_HOST" "
    docker exec $SSH_CONTAINER_NAME psql -U $SSH_POSTGRES_USER -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'\" | grep -qx 1
  " || {
    echo "❌ Erro: banco '$DB_NAME' não encontrado no servidor."
    exit 1
  }
}

backup_dev_atual() {
  local TIMESTAMP OUTPUT_FILE
  TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
  OUTPUT_FILE="$BACKUP_DIR/${SSH_POSTGRES_DEV_DB}-pre-sync-${TIMESTAMP}.sql.gz"

  echo "💾 Gerando backup preventivo do banco de dev..."
  if ! ssh -i "$SSH_KEY_PATH" "$SSH_HOST" \
    "docker exec $SSH_CONTAINER_NAME pg_dump -U $SSH_POSTGRES_USER -d $SSH_POSTGRES_DEV_DB --clean --if-exists --no-owner --no-privileges" \
    | gzip > "$OUTPUT_FILE"; then
    rm -f "$OUTPUT_FILE"
    echo "❌ Falha ao gerar backup preventivo do banco de dev."
    exit 1
  fi

  echo "📁 Backup salvo em: $OUTPUT_FILE"
}

sincronizar_prod_para_dev() {
  echo "📦 Clonando estrutura e dados de produção para dev..."
  ssh -i "$SSH_KEY_PATH" "$SSH_HOST" "
    set -e
    docker exec $SSH_CONTAINER_NAME sh -lc '
      set -e
      psql -v ON_ERROR_STOP=1 -U \"$SSH_POSTGRES_USER\" -d \"$SSH_POSTGRES_DEV_DB\" -c \"ALTER SCHEMA public OWNER TO $SSH_POSTGRES_USER;\"
      psql -v ON_ERROR_STOP=1 -U \"$SSH_POSTGRES_USER\" -d \"$SSH_POSTGRES_DEV_DB\" -c \"DROP SCHEMA IF EXISTS public CASCADE;\"
      psql -v ON_ERROR_STOP=1 -U \"$SSH_POSTGRES_USER\" -d \"$SSH_POSTGRES_DEV_DB\" -c \"CREATE SCHEMA public;\"
      psql -v ON_ERROR_STOP=1 -U \"$SSH_POSTGRES_USER\" -d \"$SSH_POSTGRES_DEV_DB\" -c \"DROP SCHEMA IF EXISTS drizzle CASCADE;\"

      pg_dump -U \"$SSH_POSTGRES_USER\" -d \"$SSH_POSTGRES_DB\" --no-owner --no-privileges \
      | psql -v ON_ERROR_STOP=1 -U \"$SSH_POSTGRES_USER\" -d \"$SSH_POSTGRES_DEV_DB\"
    '
  " || {
    echo "❌ Falha ao espelhar produção em dev."
    exit 1
  }
}

sanitizar_dev() {
  echo "🧼 Sanitizando dados sensíveis no banco de dev..."
  if ! cat "$SANITIZE_SQL" | ssh -i "$SSH_KEY_PATH" "$SSH_HOST" \
    "docker exec -i $SSH_CONTAINER_NAME psql -v ON_ERROR_STOP=1 -U $SSH_POSTGRES_USER -d $SSH_POSTGRES_DEV_DB"; then
    echo "❌ Falha ao sanitizar banco de dev."
    exit 1
  fi
}

executar_migrate_pos_sync() {
  echo ""
  read -p "Deseja executar o alinhamento de migrations agora (npm run db:migrate)? [s/N]: " CONFIRM_MIGRATE

  if [ -n "$CONFIRM_MIGRATE" ] && confirmar_letra "$CONFIRM_MIGRATE"; then
    echo "🚀 Executando migrations em dev..."
    if (cd "$PROJECT_DIR" && npm run db:migrate); then
      echo "✅ Migrations aplicadas com sucesso."
    else
      echo "⚠️ Não foi possível executar migrate automaticamente."
      echo "   Se necessário, rode manualmente:"
      echo "   1) ./scripts/db-tunnel.sh"
      echo "   2) npm run db:migrate"
    fi
  else
    echo "ℹ️ Migrate automático não executado."
    echo "   Sugestão:"
    echo "   1) ./scripts/db-tunnel.sh"
    echo "   2) npm run db:migrate"
  fi
}

echo ""
echo "============================================"
echo "   🔄 ESPELHAMENTO PRODUÇÃO -> DEV VIA SSH  "
echo "============================================"
echo ""
echo "Origem : $SSH_POSTGRES_DB"
echo "Destino: $SSH_POSTGRES_DEV_DB"
echo ""
read -p "Deseja aplicar sanitização após o sync? [S/n]: " CONFIRM_SANITIZE
if [ -z "$CONFIRM_SANITIZE" ] || confirmar_letra "$CONFIRM_SANITIZE"; then
  SANITIZE_AFTER_SYNC="true"
  MODE_LABEL="com sanitização"
else
  SANITIZE_AFTER_SYNC="false"
  MODE_LABEL="sem sanitização"
fi

read -p "Deseja gerar backup preventivo do banco de dev antes do sync? [S/n]: " CONFIRM_BACKUP
if [ -z "$CONFIRM_BACKUP" ] || confirmar_letra "$CONFIRM_BACKUP"; then
  BACKUP_BEFORE_SYNC="true"
  BACKUP_LABEL="com backup preventivo"
else
  BACKUP_BEFORE_SYNC="false"
  BACKUP_LABEL="sem backup preventivo"
fi

echo ""
echo "⚠️  Esta operação NÃO PODE ser desfeita!"
echo "    Origem : $SSH_POSTGRES_DB"
echo "    Destino: $SSH_POSTGRES_DEV_DB"
echo "    Modo   : $MODE_LABEL"
echo "    Backup : $BACKUP_LABEL"
echo ""
CONFIRM_CODE="$(gerar_codigo_confirmacao)"
echo "⚠️ CONFIRMAÇÃO FINAL — Digite o código abaixo para continuar:"
echo "    ➜ $CONFIRM_CODE"
read -p "> " CONFIRM2

if [ "$CONFIRM2" != "$CONFIRM_CODE" ]; then
  echo "❌ Código incorreto. Operação cancelada."
  exit 1
fi

testar_conexao
validar_container
validar_banco_existe "$SSH_POSTGRES_DB"
validar_banco_existe "$SSH_POSTGRES_DEV_DB"
if [ "$BACKUP_BEFORE_SYNC" = "true" ]; then
  backup_dev_atual
else
  echo "⚠️ Backup preventivo ignorado."
fi
sincronizar_prod_para_dev

if [ "$SANITIZE_AFTER_SYNC" = "true" ]; then
  sanitizar_dev
else
  echo "⚠️ Banco de dev mantido sem sanitização."
fi

executar_migrate_pos_sync

echo ""
echo "============================================"
echo "   🎉 Espelhamento concluído com sucesso!   "
echo "============================================"
