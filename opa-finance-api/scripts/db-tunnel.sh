#!/usr/bin/env bash
set -e
set -o pipefail

# ===== FLAGS =====
FLAG_STATUS=false
FLAG_FORCE=false

for arg in "$@"; do
  case "$arg" in
    --status) FLAG_STATUS=true ;;
    --force)  FLAG_FORCE=true ;;
    *) ;;
  esac
done

# ===== LOCALIZAR .ENV =====
ENV_FILE="$(dirname "$0")/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Arquivo .env não encontrado em $ENV_FILE"
  exit 1
fi

echo "📂 Carregando variáveis do .env..."
export $(grep -v '^#' "$ENV_FILE" | xargs)

# ===== FUNÇÕES =====
error () {
  echo "❌ $1"
  exit 1
}

success () {
  echo "✅ $1"
}

info () {
  echo "🔹 $1"
}

ask_yes_no () {
  local prompt="$1"
  read -p "$prompt [s/N]: " answer
  echo "$answer" | grep -Eiq '^(s|sim|y|yes)$'
}

show_status () {
  local pid
  pid=$(lsof -ti tcp:$LOCAL_DB_PORT || true)

  if [ -n "$pid" ]; then
    success "Túnel ATIVO em localhost:$LOCAL_DB_PORT (PID $pid)"
    return 0
  else
    info "Nenhum túnel ativo em localhost:$LOCAL_DB_PORT"
    return 1
  fi
}

resolve_container_ip () {
  info "Resolvendo IP do container '$POSTGRES_CONTAINER_NAME' via SSH..."

  CONTAINER_IP=$(ssh "$SSH_HOST" \
    "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $POSTGRES_CONTAINER_NAME" \
    2>/dev/null)

  if [ -z "$CONTAINER_IP" ]; then
    error "Não foi possível resolver o IP do container '$POSTGRES_CONTAINER_NAME'"
  fi

  success "IP do container resolvido: $CONTAINER_IP"
}

# ===== VALIDAÇÕES =====
command -v ssh >/dev/null || error "ssh não encontrado"
command -v lsof >/dev/null || error "lsof não encontrado"
command -v nc >/dev/null || error "nc (netcat) não encontrado"

: "${SSH_HOST:?Variável SSH_HOST não definida}"
: "${LOCAL_DB_PORT:?Variável LOCAL_DB_PORT não definida}"
: "${REMOTE_DB_PORT:?Variável REMOTE_DB_PORT não definida}"
: "${POSTGRES_CONTAINER_NAME:?Variável POSTGRES_CONTAINER_NAME não definida}"

# ===== STATUS ONLY =====
if $FLAG_STATUS; then
  show_status
  exit 0
fi

# ===== VERIFICAR TÚNEL EXISTENTE =====
EXISTING_PID=$(lsof -ti tcp:$LOCAL_DB_PORT || true)

if [ -n "$EXISTING_PID" ]; then
  info "Já existe um túnel ativo na porta $LOCAL_DB_PORT (PID $EXISTING_PID)"

  if $FLAG_FORCE; then
    kill "$EXISTING_PID"
    success "Túnel encerrado automaticamente (--force)"
    exit 0
  fi

  if ask_yes_no "Deseja encerrar o túnel atual?"; then
    kill "$EXISTING_PID"
    success "Túnel encerrado com sucesso"
    exit 0
  else
    info "Mantendo túnel ativo. Nenhuma ação realizada."
    exit 0
  fi
fi

# ===== RESOLVER IP DO CONTAINER =====
resolve_container_ip

# ===== ABRIR NOVO TÚNEL =====
info "Abrindo túnel SSH"
info "localhost:$LOCAL_DB_PORT → $CONTAINER_IP:$REMOTE_DB_PORT ($SSH_HOST)"

ssh -N -L ${LOCAL_DB_PORT}:${CONTAINER_IP}:${REMOTE_DB_PORT} ${SSH_HOST} &
SSH_PID=$!

sleep 2

# ===== TESTE =====
if nc -z localhost $LOCAL_DB_PORT; then
  success "Túnel SSH ativo com sucesso!"
  echo "🟢 PostgreSQL disponível em: localhost:$LOCAL_DB_PORT"
  echo "🔑 PID do túnel: $SSH_PID"
  echo "⛔ CTRL+C para encerrar"
else
  kill $SSH_PID >/dev/null 2>&1
  error "Falha ao abrir túnel SSH"
fi

wait $SSH_PID