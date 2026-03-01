#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_BRANCH="${DEV_BRANCH:-dev}"

confirmar_letra() {
  local input="$1"
  local first_char
  first_char="$(echo "$input" | cut -c1 | tr '[:upper:]' '[:lower:]')"
  [ "$first_char" = "s" ]
}

mostrar_versao_atual() {
  local current_branch
  current_branch="$(git -C "$ROOT_DIR" branch --show-current)"

  node - "$ROOT_DIR" "$current_branch" <<'EOF'
const { execSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const rootDir = process.argv[2]
const currentBranch = process.argv[3]

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function getCommitCount() {
  return Number(
    execSync('git rev-list --count HEAD', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(),
  )
}

function getVersionInfo(packageJson) {
  const totalCommits = getCommitCount()
  const cycleStart = Number(packageJson.versioning?.cycleStartCommitCount ?? 0)
  const [major = '0', minor = '0'] = String(packageJson.version || '0.0.0').split('.')
  const patch = Math.max(totalCommits - cycleStart, 0)

  return {
    base: `${major}.${minor}.0`,
    dev: `${major}.${minor}.${patch}-dev`,
    prod: `${major}.${minor}.${patch}`,
    cycleStart,
    totalCommits,
  }
}

const frontPkg = readJson(resolve(rootDir, 'opa-finance-front/package.json'))
const apiPkg = readJson(resolve(rootDir, 'opa-finance-api/package.json'))
const frontInfo = getVersionInfo(frontPkg)
const apiInfo = getVersionInfo(apiPkg)

console.log('')
console.log('============================================')
console.log('        📌 VERSÃO CALCULADA ATUAL           ')
console.log('============================================')
console.log('')
console.log(`Branch atual: ${currentBranch || '(desconhecida)'}`)
console.log(`Total de commits: ${apiInfo.totalCommits}`)
console.log('')
console.log('Frontend:')
console.log(`  Base do ciclo: ${frontInfo.base}`)
console.log(`  Desenvolvimento: ${frontInfo.dev}`)
console.log(`  Produção: ${frontInfo.prod}`)
console.log(`  Início do ciclo (commit): ${frontInfo.cycleStart}`)
console.log('')
console.log('Backend:')
console.log(`  Base do ciclo: ${apiInfo.base}`)
console.log(`  Desenvolvimento: ${apiInfo.dev}`)
console.log(`  Produção: ${apiInfo.prod}`)
console.log(`  Início do ciclo (commit): ${apiInfo.cycleStart}`)
console.log('')
EOF
}

executar_inicio_ciclo_dev() {
  echo ""
  echo "⚠️  Esta operacao vai criar ou atualizar a branch '$DEV_BRANCH',"
  echo "    subir o MINOR, zerar o PATCH e regenerar as versoes em modo dev."
  echo ""

  read -r -p "Digite SIM para continuar (qualquer valor começando com S): " CONFIRM
  if ! confirmar_letra "$CONFIRM"; then
    echo "❌ Operação cancelada."
    exit 1
  fi

  bash "$ROOT_DIR/scripts/start-dev-cycle.sh" "$DEV_BRANCH"
}

executar_promocao_main() {
  echo ""
  echo "⚠️  Esta operacao vai promover '$DEV_BRANCH' para 'main',"
  echo "    criar a tag da release e regenerar as versoes em modo producao."
  echo ""

  read -r -p "Digite SIM para continuar (qualquer valor começando com S): " CONFIRM
  if ! confirmar_letra "$CONFIRM"; then
    echo "❌ Operação cancelada."
    exit 1
  fi

  bash "$ROOT_DIR/scripts/promote-dev-to-main.sh" "$DEV_BRANCH"
}

echo ""
echo "============================================"
echo "         🔖 CICLO DE VERSIONAMENTO          "
echo "============================================"
echo ""
echo "O que deseja fazer?"
echo ""
echo "  1️⃣  Iniciar novo ciclo em '$DEV_BRANCH' (sobe MINOR e zera PATCH)"
echo "  2️⃣  Promover '$DEV_BRANCH' para 'main' (merge/tag local, push manual)"
echo "  3️⃣  Mostrar versão calculada atual"
echo "  4️⃣  Cancelar"
echo ""

read -r -p "Escolha uma opção (1/2/3/4): " OPCAO

case "$OPCAO" in
  1) executar_inicio_ciclo_dev ;;
  2) executar_promocao_main ;;
  3)
    mostrar_versao_atual
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
