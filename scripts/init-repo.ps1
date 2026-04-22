# ============================================================
# VilaVest — Script de inicialização do repositório
# Executar UMA VEZ a partir da raiz do projeto em PowerShell.
#   cd C:\Users\Leonardo Flores\Documents\Projetos\VilaVest
#   .\scripts\init-repo.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "==> Limpando .git existente (se estiver quebrado)..." -ForegroundColor Cyan
if (Test-Path ".git") {
    Remove-Item -Recurse -Force ".git"
}

Write-Host "==> git init" -ForegroundColor Cyan
git init -b main | Out-Null

Write-Host "==> Configurando autor local" -ForegroundColor Cyan
git config user.email "leonardo.flores@berzerk.com.br"
git config user.name "Leonardo Flores"

Write-Host "==> Adicionando remote (SSH)" -ForegroundColor Cyan
git remote add origin git@github.com:Leonardo-Flores/vilavest.git 2>$null
git remote set-url origin git@github.com:Leonardo-Flores/vilavest.git

Write-Host "==> Stage + commit inicial" -ForegroundColor Cyan
git add -A
git commit -m "feat: initial VilaVest e-commerce scaffold

- Backend: Go 1.22 monolito modular (chi, pgx, JWT, audit)
- Frontend: React 18 + Vite + Tailwind
- Postgres 16 (docker-compose local; Neon em cloud)
- Deploy: Fly.io (dev + prod), Vercel (frontend), Neon (db)
- CI/CD: GitHub Actions (CI + deploy automatico por branch)
- Docs: README.md + DEPLOYMENT.md"

Write-Host "==> Push main" -ForegroundColor Cyan
git push -u origin main

Write-Host "==> Criando branch develop" -ForegroundColor Cyan
git checkout -b develop
git push -u origin develop

Write-Host ""
Write-Host "[OK] Repositorio publicado!" -ForegroundColor Green
Write-Host "     https://github.com/Leonardo-Flores/vilavest" -ForegroundColor Green
Write-Host ""
Write-Host "Proximo passo: siga o DEPLOYMENT.md para configurar Neon, Fly.io e Vercel." -ForegroundColor Yellow
