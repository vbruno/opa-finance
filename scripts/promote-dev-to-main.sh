#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_BRANCH="${1:-dev}"

cd "$ROOT_DIR"

tem_remote_origin() {
  git remote get-url origin >/dev/null 2>&1
}

garantir_branch_local_sincronizada_com_origin() {
  local BRANCH="$1"

  if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    return 0
  fi

  if ! git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    return 0
  fi

  local AHEAD
  local BEHIND
  read -r AHEAD BEHIND < <(git rev-list --left-right --count "$BRANCH...origin/$BRANCH")

  if [ "$AHEAD" -eq 0 ] && [ "$BEHIND" -eq 0 ]; then
    return 0
  fi

  echo "Erro: branch local '$BRANCH' fora de sincronia com 'origin/$BRANCH'."
  echo "  Commits locais nao enviados: $AHEAD"
  echo "  Commits remotos nao trazidos: $BEHIND"
  echo "Sincronize antes de continuar."
  echo "Sugestao:"
  echo "  git checkout $BRANCH"
  echo "  git pull --ff-only origin $BRANCH"
  exit 1
}

if ! git diff --quiet --ignore-submodules HEAD --; then
  echo "Erro: existe mudanca nao commitada. Limpe a arvore antes de promover a release."
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/$DEV_BRANCH"; then
  echo "Erro: a branch '$DEV_BRANCH' nao existe localmente."
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/main"; then
  echo "Erro: a branch 'main' nao existe localmente."
  exit 1
fi

if tem_remote_origin; then
  git fetch origin --prune
  garantir_branch_local_sincronizada_com_origin "main"
  garantir_branch_local_sincronizada_com_origin "$DEV_BRANCH"
fi

if ! git merge-base --is-ancestor main "$DEV_BRANCH"; then
  echo "Erro: 'main' nao e ancestral de '$DEV_BRANCH'."
  echo "Resolva o historico antes de promover a release."
  exit 1
fi

RELEASE_VERSION="$(node - "$ROOT_DIR" <<'EOF'
const { execSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const rootDir = process.argv[2]
const devBranch = process.env.DEV_BRANCH_NAME

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function getCommitCount(branchName) {
  return Number(
    execSync(`git rev-list --count ${branchName}`, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(),
  )
}

function getReleaseVersion(packageJson) {
  const totalCommits = getCommitCount(devBranch)
  const cycleStart = Number(packageJson.versioning?.cycleStartCommitCount ?? 0)
  const [major = '0', minor = '0'] = String(packageJson.version || '0.0.0').split('.')
  return `${major}.${minor}.${Math.max(totalCommits - cycleStart, 0)}`
}

const frontPkg = readJson(resolve(rootDir, 'opa-finance-front/package.json'))
const apiPkg = readJson(resolve(rootDir, 'opa-finance-api/package.json'))

if (String(frontPkg.version || '') !== String(apiPkg.version || '')) {
  console.error('Erro: frontend e backend estao com bases de versao diferentes.')
  process.exit(10)
}

if (
  Number(frontPkg.versioning?.cycleStartCommitCount ?? 0) !==
  Number(apiPkg.versioning?.cycleStartCommitCount ?? 0)
) {
  console.error('Erro: frontend e backend estao com inicios de ciclo diferentes.')
  process.exit(11)
}

process.stdout.write(getReleaseVersion(apiPkg))
EOF
)" DEV_BRANCH_NAME="$DEV_BRANCH"

TAG_NAME="v${RELEASE_VERSION}"

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "Erro: a tag '$TAG_NAME' ja existe localmente."
  exit 1
fi

if tem_remote_origin && git ls-remote --tags --exit-code origin "refs/tags/$TAG_NAME" >/dev/null 2>&1; then
  echo "Erro: a tag '$TAG_NAME' ja existe no remoto 'origin'."
  exit 1
fi

MAIN_SHA="$(git rev-parse --short main)"
DEV_SHA="$(git rev-parse --short "$DEV_BRANCH")"

echo "Release calculada: ${RELEASE_VERSION}"
echo "Branch origem: ${DEV_BRANCH} (${DEV_SHA})"
echo "Branch destino: main (${MAIN_SHA})"
echo "Tag a ser criada: ${TAG_NAME}"
printf "Confirmar merge de '%s' para 'main' e criar tag '%s'? [y/N] " "$DEV_BRANCH" "$TAG_NAME"
read -r CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Operacao cancelada."
  exit 0
fi

git checkout main
git merge --ff-only "$DEV_BRANCH"

NODE_ENV=production node "$ROOT_DIR/opa-finance-front/scripts/generate-version.mjs"
NODE_ENV=production node "$ROOT_DIR/opa-finance-api/scripts/generate-version.mjs"

git tag -a "$TAG_NAME" -m "Release ${TAG_NAME}"

echo
echo "Release preparada em 'main' com tag '${TAG_NAME}'."
echo "Verificacoes aplicadas:"
echo "  - arvore local limpa"
echo "  - branches '$DEV_BRANCH' e 'main' existentes"
echo "  - merge fast-forward valido"
echo "  - bases de versao e ciclo alinhados entre frontend e backend"
echo "  - tag local inexistente antes da criacao"
echo "  - arquivos de versao regenerados localmente antes da tag"
echo
echo "Proximo passo sugerido:"
echo "  git push origin main"
echo "  git push origin ${TAG_NAME}"
