# =============================================================
# VilaVest — Script de Setup Completo (GitHub + Deploy)
# Execute no PowerShell na pasta do projeto:
#   .\setup-github.ps1
# =============================================================

Write-Host "`n🏪 VilaVest — Setup GitHub + Deploy`n" -ForegroundColor Cyan

# ----------------------------------------------------------
# 1. Verificar pré-requisitos
# ----------------------------------------------------------
Write-Host "📋 Verificando pré-requisitos..." -ForegroundColor Yellow

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git não encontrado. Instale: winget install Git.Git" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  GitHub CLI não encontrado. Instalando..." -ForegroundColor Yellow
    winget install GitHub.cli --accept-source-agreements --accept-package-agreements
    Write-Host "🔄 Feche e reabra o PowerShell, depois rode este script novamente." -ForegroundColor Yellow
    exit 0
}

# Verificar autenticação do gh
$ghStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "🔐 Autenticando no GitHub..." -ForegroundColor Yellow
    gh auth login
}

Write-Host "✅ Pré-requisitos OK`n" -ForegroundColor Green

# ----------------------------------------------------------
# 2. Inicializar Git (se necessário)
# ----------------------------------------------------------
if (-not (Test-Path ".git\objects")) {
    Write-Host "📦 Inicializando repositório Git..." -ForegroundColor Yellow

    # Limpar .git quebrado se existir
    if (Test-Path ".git") {
        Remove-Item -Recurse -Force ".git"
    }

    git init -b main
    git config user.email "leonardo.flores@berzerk.com.br"
    git config user.name "Leonardo Flores"

    git add -A
    git commit -m @"
feat: VilaVest e-commerce - initial release

Monolito modular completo com:
- Backend Go (Chi router, JWT auth, RBAC, audit logs, PostgreSQL)
- Frontend React (Vite, Tailwind, Recharts, admin dashboard)
- Dockerfiles multi-stage (backend + frontend)
- CI/CD GitHub Actions (Fly.io + Vercel)
- Migrations completas (17 tabelas, seeds, indexes)
- Dominio: vilavest.leonardoflores.dev.br

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
"@

    Write-Host "✅ Commit inicial criado`n" -ForegroundColor Green
} else {
    Write-Host "✅ Repositório Git já inicializado`n" -ForegroundColor Green
}

# ----------------------------------------------------------
# 3. Criar repo no GitHub e fazer push
# ----------------------------------------------------------
$hasRemote = git remote -v 2>&1
if ($hasRemote -notmatch "origin") {
    Write-Host "🚀 Criando repositório no GitHub..." -ForegroundColor Yellow
    gh repo create Leonardo-Flores/vilavest --private --source=. --push --description "VilaVest - Modern E-Commerce Platform (Go + React)"
    Write-Host "✅ Repositório criado e push realizado!`n" -ForegroundColor Green
} else {
    Write-Host "🚀 Fazendo push para o remote existente..." -ForegroundColor Yellow
    git push -u origin main
    Write-Host "✅ Push realizado!`n" -ForegroundColor Green
}

# ----------------------------------------------------------
# 4. Criar branch develop
# ----------------------------------------------------------
$branches = git branch --list develop 2>&1
if (-not $branches) {
    Write-Host "🌿 Criando branch develop..." -ForegroundColor Yellow
    git checkout -b develop
    git push -u origin develop
    git checkout main
    Write-Host "✅ Branch develop criada e pushada`n" -ForegroundColor Green
} else {
    Write-Host "✅ Branch develop já existe`n" -ForegroundColor Green
}

# ----------------------------------------------------------
# 5. Resumo final
# ----------------------------------------------------------
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   🎉 REPOSITÓRIO PRONTO!              " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Repo: https://github.com/Leonardo-Flores/vilavest"
Write-Host "  Branches: main (prod) + develop (dev)"
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Neon (banco):     https://neon.tech"
Write-Host "     - Criar projeto 'vilavest' em São Paulo"
Write-Host "     - Criar branch 'dev'"
Write-Host "     - Rodar migrations/001_initial_schema.sql em ambas"
Write-Host ""
Write-Host "  2. Fly.io (backend): https://fly.io"
Write-Host "     - flyctl auth login"
Write-Host "     - flyctl apps create vilavest-api-dev --org personal"
Write-Host "     - flyctl apps create vilavest-api-prod --org personal"
Write-Host "     - Configurar secrets (DATABASE_URL + JWT_SECRET)"
Write-Host "     - flyctl deploy --config fly.dev.toml --remote-only"
Write-Host ""
Write-Host "  3. Vercel (frontend): https://vercel.com"
Write-Host "     - Importar repo, root=frontend, framework=Vite"
Write-Host "     - Configurar VITE_API_URL por ambiente"
Write-Host ""
Write-Host "  4. DNS (Registro.br):"
Write-Host "     - vilavest.leonardoflores.dev.br     CNAME cname.vercel-dns.com."
Write-Host "     - dev.vilavest.leonardoflores.dev.br  CNAME cname.vercel-dns.com."
Write-Host "     - api.vilavest.leonardoflores.dev.br  CNAME vilavest-api-prod.fly.dev."
Write-Host "     - api-dev.vilavest.leonardoflores.dev.br CNAME vilavest-api-dev.fly.dev."
Write-Host ""
Write-Host "  5. GitHub Secret:"
Write-Host "     - FLY_API_TOKEN em Settings > Secrets > Actions"
Write-Host ""
Write-Host "  📖 Guia completo: DEPLOYMENT.md" -ForegroundColor Cyan
Write-Host ""
