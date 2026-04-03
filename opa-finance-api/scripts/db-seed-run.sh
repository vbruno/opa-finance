#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${SEED_MODE:-}"
AUTO_YES=0

confirmar_letra() {
  local input="$1"
  local first_char
  first_char="$(echo "$input" | tr -d '[:space:]' | cut -c1 | tr '[:upper:]' '[:lower:]')"
  [[ "$first_char" = "s" || "$first_char" = "y" ]]
}

show_help() {
  cat << 'EOF'
Uso:
  npm run db:seed
  npm run db:seed -- --mode empty|reset|demo|init|init-demo [--yes]

Modos:
  empty     -> limpa todo o banco e não recria dados
  reset     -> limpa todo o banco e recria dados iniciais completos
  demo      -> cria/atualiza apenas o usuário demo
  init      -> migrate + seed.system (bootstrap servidor zerado)
  init-demo -> migrate + seed.system + seed.demo

Opções:
  --mode <modo>  seleciona modo sem menu
  --yes          não pede confirmação interativa
  -h, --help     mostra esta ajuda
EOF
}

normalize_mode() {
  case "$1" in
    empty | reset | demo | init | init-demo) echo "$1" ;;
    *) echo "" ;;
  esac
}

generate_destructive_code() {
  local letter
  local digits
  letter="$(LC_ALL=C tr -dc 'A-Z' </dev/urandom | head -c 1)"
  digits="$(LC_ALL=C tr -dc '0-9' </dev/urandom | head -c 3)"
  echo "${letter}${digits}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      if [[ $# -lt 2 ]]; then
        echo "❌ Falta valor para --mode"
        exit 1
      fi
      MODE="$2"
      shift 2
      ;;
    --yes)
      AUTO_YES=1
      shift
      ;;
    -h | --help)
      show_help
      exit 0
      ;;
    *)
      echo "❌ Argumento inválido: $1"
      show_help
      exit 1
      ;;
  esac
done

MODE="$(normalize_mode "$MODE")"

if [[ -z "$MODE" ]]; then
  echo ""
  echo "============================================"
  echo "        🌱 WRAPPER DE SEED (SEGURO)         "
  echo "============================================"
  echo ""
  echo "Qual modo deseja executar?"
  echo ""
  echo "  1️⃣  empty  (zera banco e não recria dados)"
  echo "  2️⃣  reset  (zera banco e recria dados iniciais)"
  echo "  3️⃣  demo   (somente usuário demo)"
  echo "  4️⃣  init       (migrate + seed.system)"
  echo "  5️⃣  init-demo  (migrate + seed.system + seed.demo)"
  echo "  6️⃣  Cancelar"
  echo ""
  read -r -p "Escolha uma opção (1/2/3/4/5/6): " OPTION

  case "$OPTION" in
    1) MODE="empty" ;;
    2) MODE="reset" ;;
    3) MODE="demo" ;;
    4) MODE="init" ;;
    5) MODE="init-demo" ;;
    6)
      echo "❌ Operação cancelada."
      exit 0
      ;;
    *)
      echo "❌ Opção inválida."
      exit 1
      ;;
  esac
fi

if [[ $AUTO_YES -ne 1 ]]; then
  echo ""
  case "$MODE" in
    empty)
      echo "⚠️  MODO EMPTY: vai apagar todos os dados e deixar banco vazio."
      ;;
    reset)
      echo "⚠️  MODO RESET: vai apagar todos os dados e recriar dados iniciais."
      ;;
    demo)
      echo "ℹ️  MODO DEMO: vai atualizar apenas o usuário demo."
      ;;
    init)
      echo "ℹ️  MODO INIT: vai executar migrate + seed.system."
      ;;
    init-demo)
      echo "ℹ️  MODO INIT-DEMO: vai executar migrate + seed.system + seed.demo."
      ;;
  esac

  read -r -p "Deseja continuar? (s/sim/n): " CONFIRM
  if ! confirmar_letra "$CONFIRM"; then
    echo "❌ Operação cancelada."
    exit 1
  fi
fi

if [[ "$MODE" == "empty" || "$MODE" == "reset" ]]; then
  DESTRUCTIVE_CODE="$(generate_destructive_code)"
  echo ""
  echo "🔐 Confirmação extra de segurança"
  echo "Digite o código abaixo para continuar (1 letra + 3 números):"
  echo "   ➜ $DESTRUCTIVE_CODE"
  read -r -p "> " TYPED_CODE
  if [[ "$TYPED_CODE" != "$DESTRUCTIVE_CODE" ]]; then
    echo "❌ Código incorreto. Operação cancelada."
    exit 1
  fi
fi

if [[ "${NODE_ENV:-}" == "production" ]]; then
  case "$MODE" in
    empty)
      export SEED_CONFIRM="${SEED_CONFIRM:-PROD_EMPTY_OK}"
      ;;
    reset)
      export SEED_CONFIRM="${SEED_CONFIRM:-PROD_RESET_OK}"
      ;;
    demo)
      export DEMO_SEED_CONFIRM="${DEMO_SEED_CONFIRM:-PROD_DEMO_OK}"
      ;;
    init-demo)
      export DEMO_SEED_CONFIRM="${DEMO_SEED_CONFIRM:-PROD_DEMO_OK}"
      ;;
  esac
fi

echo ""
echo "▶ Executando modo: $MODE"
case "$MODE" in
  empty) npx tsx src/db/seed.empty.ts ;;
  reset) npx tsx src/db/seed.reset.ts ;;
  demo) npx tsx src/db/seed.demo.ts ;;
  init)
    npx drizzle-kit migrate
    npx tsx src/db/seed.system.ts
    ;;
  init-demo)
    npx drizzle-kit migrate
    npx tsx src/db/seed.system.ts
    npx tsx src/db/seed.demo.ts
    ;;
esac

echo "✅ Concluído."
