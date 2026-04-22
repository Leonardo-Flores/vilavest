@echo off
setlocal enabledelayedexpansion

echo.
echo ======================================
echo   VilaVest - Setup GitHub + Deploy
echo ======================================
echo.

REM ----------------------------------------------------------
REM 1. Verificar pre-requisitos
REM ----------------------------------------------------------
echo [1/5] Verificando pre-requisitos...

where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERRO: Git nao encontrado. Instale: winget install Git.Git
    pause
    exit /b 1
)

where gh >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo GitHub CLI nao encontrado. Instalando...
    winget install GitHub.cli --accept-source-agreements --accept-package-agreements
    echo.
    echo Feche e reabra o CMD, depois rode este script novamente.
    pause
    exit /b 0
)

gh auth status >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Autenticando no GitHub...
    call gh auth login
)

echo OK: Pre-requisitos verificados.
echo.

REM ----------------------------------------------------------
REM 2. Inicializar Git (se necessario)
REM ----------------------------------------------------------
echo [2/5] Verificando repositorio Git...

if not exist ".git\objects" (
    echo Inicializando repositorio Git...

    if exist ".git" (
        rmdir /s /q ".git"
    )

    call git init -b main
    call git config user.email "leonardo.flores@berzerk.com.br"
    call git config user.name "Leonardo Flores"

    call git add -A
    call git commit -m "feat: VilaVest e-commerce - initial release" -m "Backend Go + Frontend React + Docker + CI/CD" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

    echo OK: Commit inicial criado.
) else (
    echo OK: Repositorio Git ja inicializado.
)
echo.

REM ----------------------------------------------------------
REM 3. Criar repo no GitHub e fazer push
REM ----------------------------------------------------------
echo [3/5] Configurando GitHub...

git remote -v 2>nul | findstr "origin" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Criando repositorio no GitHub...
    call gh repo create Leonardo-Flores/vilavest --private --source=. --push --description "VilaVest - E-Commerce Platform"
    echo OK: Repositorio criado e push realizado!
) else (
    echo Fazendo push para o remote existente...
    call git push -u origin main
    echo OK: Push realizado!
)
echo.

REM ----------------------------------------------------------
REM 4. Criar branch develop
REM ----------------------------------------------------------
echo [4/5] Criando branch develop...

git branch --list develop | findstr "develop" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    call git checkout -b develop
    call git push -u origin develop
    call git checkout main
    echo OK: Branch develop criada e pushada.
) else (
    echo OK: Branch develop ja existe.
)
echo.

REM ----------------------------------------------------------
REM 5. Resumo final
REM ----------------------------------------------------------
echo [5/5] Concluido!
echo.
echo ========================================
echo   REPOSITORIO PRONTO!
echo ========================================
echo.
echo   Repo: https://github.com/Leonardo-Flores/vilavest
echo   Branches: main (prod) + develop (dev)
echo.
echo ----------------------------------------
echo   PROXIMOS PASSOS:
echo ----------------------------------------
echo.
echo   1. Neon (banco): https://neon.tech
echo   2. Fly.io (backend): https://fly.io
echo   3. Vercel (frontend): https://vercel.com
echo   4. DNS no Registro.br (4 CNAMEs)
echo   5. FLY_API_TOKEN no GitHub Secrets
echo.
echo   Guia completo: DEPLOYMENT.md
echo.
pause
