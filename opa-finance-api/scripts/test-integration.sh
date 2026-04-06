#!/usr/bin/env bash
set -euo pipefail

LOCK_DIR="${TMPDIR:-/tmp}/opa-finance-api-integration-test.lock"
LOCK_PID_FILE="${LOCK_DIR}/pid"

ensure_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" >"$LOCK_PID_FILE"
    return
  fi

  local lock_pid=""
  if [[ -f "$LOCK_PID_FILE" ]]; then
    lock_pid="$(cat "$LOCK_PID_FILE" 2>/dev/null || true)"
  fi

  if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
    echo "❌ Já existe uma execução de integração em andamento (PID: $lock_pid)."
    echo "   Aguarde finalizar e execute novamente."
    exit 1
  fi

  echo "⚠️ Lock órfão detectado. Limpando e prosseguindo..."
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
  echo "$$" >"$LOCK_PID_FILE"
}

cleanup() {
  rm -rf "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

ensure_lock

npx vitest run test/integration
