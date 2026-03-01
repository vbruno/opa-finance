#!/usr/bin/env bash
#
# ============================================================
# 🔐 db-tunnel.sh — Túnel SSH seguro para PostgreSQL em Docker
# ============================================================
#
# ✔ Resolve Postgres rodando em Docker
# ✔ Detecta se a porta está publicada no HOST
# ✔ Cria túnel SSH corretamente (via localhost)
# ✔ Evita túnel zumbi
# ✔ Flags: --status --force --verbose
#
# ============================================================

set -e
set -o pipefail

# ==============================
# FLAGS
# ==============================
FLAG_STATUS=false
FLAG_FORCE=false
FLAG_VERBOSE=false

for arg in "$@"; do
  case "$arg" in
    --status)  FLAG_STATUS=true ;;
    --force)   FLAG_FORCE=true ;;
    --verbose) FLAG_VERBOSE=true ;;
  esac
done

# ==============================
# LOCALIZAR .ENV
# ==============================
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"

[ ! -f "$ENV_FILE" ] && echo "❌ .env não encontrado em $ENV_FILE" && exit 1

echo "📂 Carregando variáveis do .env..."
set -a
. "$ENV_FILE"
set +a

# ==============================
# LOGS
# ==============================
logv() { $FLAG_VERBOSE && echo "🧪 $1"; }
info() { echo "🔹 $1"; }
success() { echo "✅ $1"; }
error() { echo "❌ $1"; exit 1; }

ask_yes_no () {
  read -p "$1 [s/N]: " answer
  echo "$answer" | grep -Eiq '^(s|sim|y|yes)$'
}

# ==============================
# VALIDACOES
# ==============================
command -v ssh  >/dev/null || error "ssh não encontrado"
command -v lsof >/dev/null || error "lsof não encontrado"
command -v nc   >/dev/null || error "nc não encontrado"

: "${SSH_HOST:?}"
: "${LOCAL_DB_PORT:?}"
: "${REMOTE_DB_PORT:?}"
: "${POSTGRES_CONTAINER_NAME:?}"

# ==============================
# STATUS
# ==============================
show_status () {
  PID=$(lsof -ti tcp:$LOCAL_DB_PORT || true)
  [ -n "$PID" ] \
    && success "Túnel ATIVO em localhost:$LOCAL_DB_PORT (PID $PID)" \
    || info "Nenhum túnel ativo"
}

$FLAG_STATUS && show_status && exit 0

# ==============================
# LIMPAR TÚNEL ZOMBIE
# ==============================
PID=$(lsof -ti tcp:$LOCAL_DB_PORT || true)
if [ -n "$PID" ] && ! nc -z localhost "$LOCAL_DB_PORT" >/dev/null 2>&1; then
  info "Túnel zombie detectado (PID $PID)"
  kill "$PID" || true
  success "Túnel zombie removido"
fi

# ==============================
# TÚNEL JÁ ATIVO
# ==============================
PID=$(lsof -ti tcp:$LOCAL_DB_PORT || true)
if [ -n "$PID" ]; then
  info "Já existe túnel ativo (PID $PID)"

  $FLAG_FORCE && kill "$PID" && success "Encerrado (--force)" && exit 0

  ask_yes_no "Encerrar túnel atual?" \
    && kill "$PID" && success "Encerrado" && exit 0 \
    || info "Mantido ativo" && exit 0
fi

# ==============================
# VALIDAR POSTGRES NO HOST
# ==============================
info "Validando Postgres no HOST remoto..."

if ! ssh "$SSH_HOST" "nc -z localhost $REMOTE_DB_PORT" >/dev/null 2>&1; then
  error "Postgres NÃO está acessível no HOST remoto (localhost:$REMOTE_DB_PORT)
➡ Verifique se o container expõe a porta assim:
ports:
  - \"127.0.0.1:$REMOTE_DB_PORT:$REMOTE_DB_PORT\""
fi

success "Postgres acessível no HOST remoto"

# ==============================
# ABRIR TÚNEL SSH (FORMA CORRETA)
# ==============================
info "Abrindo túnel SSH"
info "localhost:$LOCAL_DB_PORT → localhost:$REMOTE_DB_PORT ($SSH_HOST)"

ssh -N \
  -L ${LOCAL_DB_PORT}:localhost:${REMOTE_DB_PORT} \
  -o ExitOnForwardFailure=yes \
  "$SSH_HOST" &

SSH_PID=$!
sleep 2

# ==============================
# TESTE FINAL
# ==============================
if nc -z localhost "$LOCAL_DB_PORT"; then
  success "Túnel SSH ativo!"
  echo "🟢 PostgreSQL: localhost:$LOCAL_DB_PORT"
  echo "🔑 PID: $SSH_PID"
  echo "⛔ CTRL+C para encerrar"
else
  kill "$SSH_PID" || true
  error "Falha ao estabelecer túnel"
fi

wait "$SSH_PID"
