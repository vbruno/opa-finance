#!/usr/bin/env bash
set -euo pipefail

LOCK_DIR="${TMPDIR:-/tmp}/opa-finance-api-integration-test.lock"
LOCK_PID_FILE="${LOCK_DIR}/pid"

is_integration_test_process() {
  local pid="$1"
  local command=""

  command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ -z "$command" ]]; then
    return 1
  fi

  [[ "$command" == *"vitest run test/integration"* || "$command" == *"test-integration.sh"* ]]
}

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
    if is_integration_test_process "$lock_pid"; then
      echo "❌ Já existe uma execução de integração em andamento (PID: $lock_pid)."
      echo "   Aguarde finalizar e execute novamente."
      exit 1
    fi
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
