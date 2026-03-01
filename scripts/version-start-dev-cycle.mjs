import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

const packageJsonPaths = [
  resolve(rootDir, 'opa-finance-front/package.json'),
  resolve(rootDir, 'opa-finance-api/package.json'),
]

function getCurrentBranch() {
  return execSync('git branch --show-current', {
    cwd: rootDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
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

function updatePackageJson(packageJsonPath, commitCount) {
  const raw = readFileSync(packageJsonPath, 'utf-8')
  const packageJson = JSON.parse(raw)
  const [major = '0', currentMinor = '0'] = String(packageJson.version || '0.0.0')
    .split('.')

  packageJson.version = `${major}.${Number(currentMinor) + 1}.0`
  packageJson.versioning = {
    ...(packageJson.versioning ?? {}),
    cycleStartCommitCount: commitCount,
  }

  writeFileSync(`${packageJsonPath}`, `${JSON.stringify(packageJson, null, 2)}\n`)
}

const expectedBranch = process.argv[2] || 'dev'
const currentBranch = getCurrentBranch()

if (currentBranch !== expectedBranch) {
  console.error(
    `Erro: execute este script na branch '${expectedBranch}'. Branch atual: '${currentBranch}'.`,
  )
  process.exit(1)
}

const commitCount = getCommitCount()

for (const packageJsonPath of packageJsonPaths) {
  updatePackageJson(packageJsonPath, commitCount)
}

console.log(`Novo ciclo iniciado em '${expectedBranch}'.`)
console.log(`Base de versao atualizada e PATCH reiniciado a partir do commit ${commitCount}.`)
