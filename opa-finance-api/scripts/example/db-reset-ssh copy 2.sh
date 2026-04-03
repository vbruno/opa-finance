# NÃO OPERACIONAL - Script para rodar migrations no banco de dados remoto via SSH

#!/bin/bash

echo "=============================================="
echo "   🚀 Executar migração DRIZZLE no servidor"
echo "=============================================="

# 1) Carrega variáveis do .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
  echo "🔑 Variáveis carregadas do .env"
else
  echo "❌ Arquivo .env não encontrado!"
  exit 1
fi

# 2) Confirmar chave SSH
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_ed25519}"

if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "❌ Erro: Arquivo de chave SSH NÃO encontrado:"
  echo "   $SSH_KEY_PATH"
  exit 1
fi

echo "🔐 Usando chave SSH: $SSH_KEY_PATH"

# 3) Confirmar host remoto
if [ -z "$SSH_HOST" ]; then
  echo "❌ Variável SSH_HOST não definida no .env"
  exit 1
fi

echo "🌍 Servidor: $SSH_HOST"

# 4) Primeira confirmação
echo ""
echo "⚠️  ATENÇÃO: Você está prestes a rodar MIGRATIONS em produção!"
echo "Isso pode ALTERAR TABELAS, TIPOS ou ESTRUTURA DO BANCO."
echo ""

read -p "👉 Deseja continuar? (sim/nao): " CONFIRM1
if [ "$CONFIRM1" != "sim" ]; then
  echo "❌ Operação cancelada."
  exit 1
fi

# 5) Segunda confirmação (dupla proteção)
echo ""
read -p "⚠️ Absoluta certeza? Digite 'CONFIRMO' para continuar: " CONFIRM2
if [ "$CONFIRM2" != "CONFIRMO" ]; then
  echo "❌ Operação cancelada."
  exit 1
fi

echo ""
echo "🚀 Iniciando migração no servidor remoto..."
echo ""

# 6) Comando SSH remoto
ssh -i "$SSH_KEY_PATH" "$SSH_HOST" << 'EOF'
  set -e
  echo "📦 Entrando no diretório da API"
  cd ~/opa-finance-api || exit 1

  echo "⬇️ Atualizando repositório..."
  git pull

  echo "📦 Instalando dependências..."
  npm install --silent

  echo "🗂  Rodando migrations do Drizzle..."
  npm run db:migrate

  echo "🔥 Migração concluída com sucesso!"
EOF

echo ""
echo "=============================================="
echo "   ✅ MIGRAÇÃO FINALIZADA!"
echo "=============================================="