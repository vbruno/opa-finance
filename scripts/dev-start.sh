#!/usr/bin/env bash
#
# ============================================================
# 🚀 dev-start.sh — Orquestra túnel SSH + API + Frontend em dev
# ============================================================
#
# ✔ Reaproveita túnel SSH se já estiver ativo (não derruba no exit)
# ✔ Sobe API (Fastify) e Frontend (Vite) em paralelo
# ✔ Logs interleaved com prefixo colorido [tunnel] / [api] / [front]
# ✔ Ctrl+C derruba apenas o que esse script subiu
#
# ============================================================

set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/opa-finance-api"
FRONT_DIR="$ROOT_DIR/opa-finance-front"
ENV_FILE="$API_DIR/.env"

# ==============================
# CORES
# ==============================
C_TUNNEL=$'\033[0;36m'   # ciano
C_API=$'\033[0;32m'      # verde
C_FRONT=$'\033[0;35m'    # magenta
C_INFO=$'\033[1;33m'     # amarelo
C_ERR=$'\033[0;31m'      # vermelho
C_RESET=$'\033[0m'

info()    { printf "%s🔹 %s%s\n" "$C_INFO" "$1" "$C_RESET"; }
success() { printf "%s✅ %s%s\n" "$C_INFO" "$1" "$C_RESET"; }
error()   { printf "%s❌ %s%s\n" "$C_ERR"  "$1" "$C_RESET" >&2; exit 1; }

# ==============================
# PRÉ-CHECKS
# ==============================
[ -f "$ENV_FILE" ] || error ".env não encontrado em $ENV_FILE"
[ -d "$API_DIR/node_modules" ]   || error "Backend sem node_modules. Rode: (cd opa-finance-api && npm install)"
[ -d "$FRONT_DIR/node_modules" ] || error "Frontend sem node_modules. Rode: (cd opa-finance-front && npm install)"

command -v lsof >/dev/null || error "lsof não encontrado"
command -v nc   >/dev/null || error "nc não encontrado"

# ==============================
# CARREGA .ENV (somente LOCAL_DB_PORT é obrigatório aqui)
# ==============================
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${LOCAL_DB_PORT:?LOCAL_DB_PORT ausente no .env}"

# ==============================
# HELPERS
# ==============================
prefix_stream() {
  local color="$1"
  local label="$2"
  while IFS= read -r line; do
    printf "%s[%-6s]%s %s\n" "$color" "$label" "$C_RESET" "$line"
  done
}

cleanup() {
  trap - INT TERM EXIT
  printf "\n"
  info "Encerrando serviços..."
  kill 0 2>/dev/null || true
  wait 2>/dev/null || true
  success "Tchau!"
}
trap cleanup INT TERM EXIT

# ============================================================
# 1) TÚNEL SSH
# ============================================================
if lsof -ti tcp:"$LOCAL_DB_PORT" >/dev/null 2>&1; then
  success "Túnel SSH já ativo em localhost:$LOCAL_DB_PORT — reaproveitando (não será encerrado no exit)"
else
  info "Subindo túnel SSH em localhost:$LOCAL_DB_PORT..."
  (
    cd "$API_DIR"
    bash scripts/db-tunnel.sh 2>&1
  ) | prefix_stream "$C_TUNNEL" "tunnel" &

  for _ in $(seq 1 30); do
    if nc -z localhost "$LOCAL_DB_PORT" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done

  if ! nc -z localhost "$LOCAL_DB_PORT" >/dev/null 2>&1; then
    error "Túnel não respondeu em 15s"
  fi
  success "Túnel pronto em localhost:$LOCAL_DB_PORT"
fi

# ============================================================
# 2) BACKEND (Fastify)
# ============================================================
info "Subindo backend (Fastify)..."
(
  cd "$API_DIR"
  npm run dev 2>&1
) | prefix_stream "$C_API" "api" &

# ============================================================
# 3) FRONTEND (Vite)
# ============================================================
info "Subindo frontend (Vite)..."
(
  cd "$FRONT_DIR"
  npm run dev 2>&1
) | prefix_stream "$C_FRONT" "front" &

printf "\n"
success "Tudo no ar. Ctrl+C para encerrar."
printf "\n"

wait
