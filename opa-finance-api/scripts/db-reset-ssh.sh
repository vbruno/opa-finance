#!/bin/bash
set -e

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Erro: arquivo .env nao encontrado em $ENV_FILE"
  exit 1
fi

echo "📂 Carregando variáveis do .env..."
set -a
. "$ENV_FILE"
set +a

# ---------- AJUSTE DA CHAVE SSH (~ EXPANDIDO) ----------
SSH_KEY_PATH="${SSH_KEY/#\~/$HOME}"

# ---------- VALIDAR VARIÁVEIS OBRIGATÓRIAS ----------
REQUIRED_VARS=(
  "SSH_HOST"
  "SSH_KEY"
  "SSH_CONTAINER_NAME"
  "SSH_POSTGRES_USER"
  "SSH_POSTGRES_DB"
  "SSH_POSTGRES_DEV_DB"
  "SSH_POSTGRES_TEST_DB"
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

confirmar_letra() {
  local input="$1"
  local first_char="$(echo "$input" | cut -c1 | tr '[:upper:]' '[:lower:]')"
  [ "$first_char" = "s" ]
}

selecionar_alvo() {
  case "${1:-}" in
    prod|production)
      TARGET_DB="$SSH_POSTGRES_DB"
      TARGET_LABEL="PRODUÇÃO"
      ;;
    dev|development)
      TARGET_DB="$SSH_POSTGRES_DEV_DB"
      TARGET_LABEL="DEV"
      ;;
    test)
      TARGET_DB="$SSH_POSTGRES_TEST_DB"
      TARGET_LABEL="TESTE"
      ;;
    "")
      TARGET_DB=""
      TARGET_LABEL=""
      ;;
    *)
      echo "❌ Opção inválida: $1"
      echo "   Use: prod | dev | test"
      exit 1
      ;;
  esac
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

# ---------- FUNÇÃO DE RESET DE DB + FIX DRIZZLE ----------
reset_db() {
  local DB_NAME="$1"

  echo ""
  echo "🧹 Resetando schemas PUBLIC e DRIZZLE do banco: $DB_NAME..."

  ssh -i "$SSH_KEY_PATH" "$SSH_HOST" << EOF
  # Corrigir dono do schema
  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "ALTER SCHEMA public OWNER TO $SSH_POSTGRES_USER;"

  # Dropar e recriar o schema PUBLIC
  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "DROP SCHEMA IF EXISTS public CASCADE;"

  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "CREATE SCHEMA public;"

  # Remover schema drizzle para limpar o controle de migrations
  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "DROP SCHEMA IF EXISTS drizzle CASCADE;"
EOF

  echo "✔️ Banco $DB_NAME resetado com sucesso!"
}

# -------------------------
#       MENU INTERATIVO
# -------------------------
echo ""
echo "============================================"
echo "     🧨 RESET DE BANCO VIA SSH (SEGURO)     "
echo "============================================"
echo ""

selecionar_alvo "${1:-}"

if [ -z "$TARGET_DB" ]; then
  echo "Qual banco deseja usar?"
  echo ""
  echo "  1️⃣  Banco de PRODUÇÃO"
  echo "  2️⃣  Banco de DEV"
  echo "  3️⃣  Banco de TESTE"
  echo "  4️⃣  Cancelar"
  echo ""

  read -p "Escolha uma opção (1/2/3/4): " OPCAO

  case "$OPCAO" in
    1) selecionar_alvo "prod" ;;
    2) selecionar_alvo "dev" ;;
    3) selecionar_alvo "test" ;;
    4) echo "❌ Operação cancelada."; exit 0 ;;
    *) echo "❌ Opção inválida."; exit 1 ;;
  esac
fi

echo ""
echo "⚠️  Esta operação NÃO PODE ser desfeita!"
echo "    Os bancos a serem afetados são:"
echo "    ➜ $TARGET_DB ($TARGET_LABEL)"
echo ""

read -p "Digite SIM para continuar (qualquer valor começando com S): " CONFIRM1
if ! confirmar_letra "$CONFIRM1"; then
  echo "❌ Operação cancelada."
  exit 1
fi

if [ "$TARGET_DB" = "$SSH_POSTGRES_DB" ]; then
  echo ""
  echo "⚠️ CONFIRMAÇÃO FINAL — Digite o nome EXATO do banco de produção:"
  echo "    ➜ $SSH_POSTGRES_DB"
  read -p "> " CONFIRM2

  if [ "$CONFIRM2" != "$SSH_POSTGRES_DB" ]; then
    echo "❌ Nome incorreto. Operação cancelada."
    exit 1
  fi
fi

testar_conexao
validar_container

reset_db "$TARGET_DB"

echo ""
echo "============================================"
echo "   🎉 Finalizado com sucesso!               "
echo "============================================"
