#!/bin/bash
set -e

echo "📂 Carregando variáveis do .env..."
export $(grep -v '^#' .env | xargs)

# ---------- AJUSTE DA CHAVE SSH (~ EXPANDIDO) ----------
SSH_KEY_PATH="${SSH_KEY/#\~/$HOME}"

# ---------- VALIDAR VARIÁVEIS OBRIGATÓRIAS ----------
REQUIRED_VARS=("SSH_HOST" "SSH_KEY" "SSH_CONTAINER_NAME" "SSH_POSTGRES_USER" "SSH_POSTGRES_DB" "SSH_POSTGRES_TEST_DB")

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
  echo "🧹 Resetando schema PUBLIC do banco: $DB_NAME..."

  ssh -i "$SSH_KEY_PATH" "$SSH_HOST" << EOF
  # Corrigir dono do schema
  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "ALTER SCHEMA public OWNER TO $SSH_POSTGRES_USER;"

  # Dropar e recriar o schema PUBLIC
  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "DROP SCHEMA IF EXISTS public CASCADE;"

  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "CREATE SCHEMA public;"

  # =====================================================
  #                 FIX DO SCHEMA DRIZZLE  
  # =====================================================

  # Criar schema drizzle se não existir
  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "CREATE SCHEMA IF NOT EXISTS drizzle;"

  # Transferir propriedade
  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "ALTER SCHEMA drizzle OWNER TO $SSH_POSTGRES_USER;"

  # Permissões principais
  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "GRANT USAGE, CREATE ON SCHEMA drizzle TO $SSH_POSTGRES_USER;"

  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA drizzle TO $SSH_POSTGRES_USER;"

  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA drizzle TO $SSH_POSTGRES_USER;"

  # Default privileges
  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA drizzle GRANT ALL PRIVILEGES ON TABLES TO $SSH_POSTGRES_USER;"

  docker exec $SSH_CONTAINER_NAME \
    psql -U $SSH_POSTGRES_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA drizzle GRANT ALL PRIVILEGES ON SEQUENCES TO $SSH_POSTGRES_USER;"
EOF

  echo "✔️ Banco $DB_NAME resetado e FIX drizzle aplicado!"
}

# -------------------------
#       MENU INTERATIVO
# -------------------------
echo ""
echo "============================================"
echo "     🧨 RESET DE BANCO VIA SSH (SEGURO)     "
echo "============================================"
echo ""
echo "O que deseja resetar?"
echo ""
echo "  1️⃣  Resetar SOMENTE banco de PRODUÇÃO"
echo "  2️⃣  Resetar SOMENTE banco de TESTE"
echo "  3️⃣  Resetar AMBOS (Produção + Teste)"
echo "  4️⃣  Cancelar"
echo ""

read -p "Escolha uma opção (1/2/3/4): " OPCAO

case "$OPCAO" in
  1) TARGET_LIST="$SSH_POSTGRES_DB" ;;
  2) TARGET_LIST="$SSH_POSTGRES_TEST_DB" ;;
  3) TARGET_LIST="$SSH_POSTGRES_DB $SSH_POSTGRES_TEST_DB" ;;
  4) echo "❌ Operação cancelada."; exit 0 ;;
  *) echo "❌ Opção inválida."; exit 1 ;;
esac

echo ""
echo "⚠️  Esta operação NÃO PODE ser desfeita!"
echo "    Os bancos a serem afetados são:"
echo "    ➜ $TARGET_LIST"
echo ""

read -p "Digite SIM para continuar (qualquer valor começando com S): " CONFIRM1
if ! confirmar_letra "$CONFIRM1"; then
  echo "❌ Operação cancelada."
  exit 1
fi

if [[ "$TARGET_LIST" == *"$SSH_POSTGRES_DB"* ]]; then
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

for DB in $TARGET_LIST; do
  reset_db "$DB"
done

echo ""
echo "============================================"
echo "   🎉 Finalizado com sucesso!               "
echo "============================================"