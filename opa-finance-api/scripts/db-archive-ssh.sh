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

BACKUP_DIR="$(pwd)/backups"
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

selecionar_banco() {
  echo ""
  echo "Qual banco deseja usar?"
  echo ""
  echo "  1️⃣  Banco de PRODUÇÃO"
  echo "  2️⃣  Banco de DEV"
  echo "  3️⃣  Banco de TESTE"
  echo "  4️⃣  Cancelar"
  echo ""

  read -p "Escolha uma opção (1/2/3/4): " OPCAO_BANCO

  case "$OPCAO_BANCO" in
    1)
      TARGET_DB="$SSH_POSTGRES_DB"
      TARGET_LABEL="produção"
      ;;
    2)
      TARGET_DB="$SSH_POSTGRES_DEV_DB"
      TARGET_LABEL="dev"
      ;;
    3)
      TARGET_DB="$SSH_POSTGRES_TEST_DB"
      TARGET_LABEL="teste"
      ;;
    4)
      echo "❌ Operação cancelada."
      exit 0
      ;;
    *)
      echo "❌ Opção inválida."
      exit 1
      ;;
  esac
}

gerar_backup() {
  selecionar_banco

  local TIMESTAMP
  TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
  local SAFE_LABEL
  SAFE_LABEL="$(echo "$TARGET_LABEL" | tr '[:upper:]' '[:lower:]' | sed 's/ç/c/g')"
  local OUTPUT_FILE
  OUTPUT_FILE="$BACKUP_DIR/${TARGET_DB}-${SAFE_LABEL}-${TIMESTAMP}.sql.gz"

  echo ""
  echo "⚠️  Será gerado um backup do banco:"
  echo "    ➜ $TARGET_DB"
  echo "📁 Arquivo de saída:"
  echo "    ➜ $OUTPUT_FILE"
  echo ""

  read -p "Digite SIM para continuar (qualquer valor começando com S): " CONFIRMAR
  if ! confirmar_letra "$CONFIRMAR"; then
    echo "❌ Operação cancelada."
    exit 1
  fi

  testar_conexao
  validar_container

  echo "📦 Gerando backup de $TARGET_DB..."
  if ! ssh -i "$SSH_KEY_PATH" "$SSH_HOST" \
    "docker exec $SSH_CONTAINER_NAME pg_dump -U $SSH_POSTGRES_USER -d $TARGET_DB --clean --if-exists --no-owner --no-privileges" \
    | gzip > "$OUTPUT_FILE"; then
    rm -f "$OUTPUT_FILE"
    echo "❌ Falha ao gerar backup."
    exit 1
  fi

  echo "✅ Backup concluído com sucesso!"
  echo "📁 Arquivo salvo em: $OUTPUT_FILE"
}

restaurar_backup() {
  selecionar_banco

  mapfile -t BACKUP_FILES < <(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "*.sql" -o -name "*.sql.gz" \) | sort -r)

  if [ "${#BACKUP_FILES[@]}" -eq 0 ]; then
    echo "❌ Nenhum arquivo de backup encontrado em $BACKUP_DIR"
    exit 1
  fi

  echo ""
  echo "Backups disponíveis:"
  echo ""
  for i in "${!BACKUP_FILES[@]}"; do
    echo "  $((i + 1))) $(basename "${BACKUP_FILES[$i]}")"
  done
  echo ""

  read -p "Escolha o número do backup: " FILE_OPTION

  if ! [[ "$FILE_OPTION" =~ ^[0-9]+$ ]]; then
    echo "❌ Opção inválida."
    exit 1
  fi

  FILE_INDEX=$((FILE_OPTION - 1))
  if [ "$FILE_INDEX" -lt 0 ] || [ "$FILE_INDEX" -ge "${#BACKUP_FILES[@]}" ]; then
    echo "❌ Backup inexistente."
    exit 1
  fi

  BACKUP_FILE="${BACKUP_FILES[$FILE_INDEX]}"

  echo ""
  echo "⚠️  Esta operação NÃO PODE ser desfeita!"
  echo "    O banco a ser restaurado é:"
  echo "    ➜ $TARGET_DB"
  echo "    A partir do arquivo:"
  echo "    ➜ $(basename "$BACKUP_FILE")"
  echo ""

  read -p "Digite RESTORE para continuar: " CONFIRMAR
  if [ "$CONFIRMAR" != "RESTORE" ]; then
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

  echo ""
  CONFIRM_CODE="$(gerar_codigo_confirmacao)"
  echo "⚠️ CONFIRMAÇÃO EXTRA — Digite o código abaixo para continuar:"
  echo "    ➜ $CONFIRM_CODE"
  read -p "> " CONFIRM3

  if [ "$CONFIRM3" != "$CONFIRM_CODE" ]; then
    echo "❌ Código incorreto. Operação cancelada."
    exit 1
  fi

  testar_conexao
  validar_container

  echo "♻️ Restaurando backup em $TARGET_DB..."

  if [[ "$BACKUP_FILE" == *.gz ]]; then
    if ! gzip -dc "$BACKUP_FILE" | ssh -i "$SSH_KEY_PATH" "$SSH_HOST" \
      "docker exec -i $SSH_CONTAINER_NAME psql -v ON_ERROR_STOP=1 -U $SSH_POSTGRES_USER -d $TARGET_DB"; then
      echo "❌ Falha ao restaurar backup compactado."
      exit 1
    fi
  else
    if ! cat "$BACKUP_FILE" | ssh -i "$SSH_KEY_PATH" "$SSH_HOST" \
      "docker exec -i $SSH_CONTAINER_NAME psql -v ON_ERROR_STOP=1 -U $SSH_POSTGRES_USER -d $TARGET_DB"; then
      echo "❌ Falha ao restaurar backup."
      exit 1
    fi
  fi

  echo "✅ Restore concluído com sucesso em $TARGET_DB!"
}

echo ""
echo "============================================"
echo "      💾 BACKUP / RESTORE VIA SSH           "
echo "============================================"
echo ""
echo "O que deseja fazer?"
echo ""
echo "  1️⃣  Gerar BACKUP"
echo "  2️⃣  Fazer RESTORE"
echo "  3️⃣  Cancelar"
echo ""

read -p "Escolha uma opção (1/2/3): " ACAO

case "$ACAO" in
  1) gerar_backup ;;
  2) restaurar_backup ;;
  3) echo "❌ Operação cancelada."; exit 0 ;;
  *) echo "❌ Opção inválida."; exit 1 ;;
esac
