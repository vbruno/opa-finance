#!/bin/bash
set -e

echo ""
echo "========================================="
echo " 🔍 DRIZZLE – VERIFICAÇÃO DE INTEGRIDADE "
echo "========================================="
echo ""

run_step() {
  local TITLE="$1"
  local CMD="$2"

  echo ""
  echo "➡️  $TITLE"
  echo "-----------------------------------------"

  if eval "$CMD"; then
    echo "✅ SUCESSO: $TITLE"
  else
    echo "❌ ERRO: $TITLE"
    exit 1
  fi
}

# 1. Verificar integridade geral
run_step "drizzle-kit check" \
  "npx drizzle-kit check"

# 2. Verificar se existem migrations pendentes (sem aplicá-las)
echo ""
echo "➡️  Verificando se existem migrations pendentes..."
echo "-----------------------------------------"

GENERATE_OUTPUT=$(npx drizzle-kit generate 2>&1 || true)

if echo "$GENERATE_OUTPUT" | grep -q "No schema changes"; then
  echo "✅ Nenhuma migration pendente."
else
  echo "⚠️ Foram detectadas mudanças no schema!"
  echo "   O Drizzle criaria migrations novas."
  echo ""
  echo "📄 Conteúdo detectado:"
  echo "$GENERATE_OUTPUT"
  echo ""
  echo "❌ Integridade comprometida: SCHEMA e MIGRATIONS não estão sincronizados."
  exit 1
fi

echo ""
echo "========================================="
echo " 🎉 Integridade OK!"
echo " Nenhuma diferença detectada entre schema e migrations."
echo "========================================="
echo ""