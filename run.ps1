# ============================================================
# VilaVest — script único para subir tudo do zero
#
# Uso:
#   .\run.ps1            # build + up + migrate + seed
#   .\run.ps1 -Reset     # apaga volumes e refaz tudo
#   .\run.ps1 -Logs      # apenas segue os logs
#   .\run.ps1 -Stop      # para os containers
# ============================================================

param(
    [switch]$Reset,
    [switch]$Logs,
    [switch]$Stop,
    [switch]$Smoke
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step($msg) {
    Write-Host ""
    Write-Host ">>> $msg" -ForegroundColor Cyan
}

function Test-DockerRunning {
    try {
        docker info *>$null
        return $true
    } catch {
        return $false
    }
}

if (-not (Test-DockerRunning)) {
    Write-Host "ERRO: Docker Desktop nao esta rodando. Abra o Docker Desktop primeiro." -ForegroundColor Red
    exit 1
}

if ($Stop) {
    Write-Step "Parando containers"
    docker compose down
    exit 0
}

if ($Logs) {
    Write-Step "Seguindo logs (Ctrl+C para sair)"
    docker compose logs -f --tail 50
    exit 0
}

if ($Reset) {
    Write-Step "RESET: parando containers e apagando volumes"
    docker compose down -v
}

Write-Step "Build das imagens (backend + frontend)"
$buildLog = Join-Path $root "build.log"
# docker escreve progresso em stderr — precisamos baixar ErrorActionPreference
# ou o PowerShell trata como NativeCommandError e aborta o script.
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& cmd /c "docker compose build 2>&1" | Tee-Object -FilePath $buildLog
$buildExit = $LASTEXITCODE
$ErrorActionPreference = $prevEAP
if ($buildExit -ne 0) {
    Write-Host ""
    Write-Host "ERRO: build falhou (exit=$buildExit). Log completo em:" -ForegroundColor Red
    Write-Host "  $buildLog" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "--- ultimos 40 erros do log ---" -ForegroundColor Yellow
    Select-String -Path $buildLog -Pattern 'error|invalid|undefined|cannot|expected|undeclared' -CaseSensitive:$false `
        | Select-Object -Last 40 | ForEach-Object { $_.Line }
    exit 1
}

Write-Step "Subindo servicos"
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: docker compose up falhou (exit=$LASTEXITCODE)." -ForegroundColor Red
    exit 1
}

Write-Step "Aguardando backend responder em http://localhost:8080/health"
$ok = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 2 -UseBasicParsing
        if ($resp.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline
}
Write-Host ""

if (-not $ok) {
    Write-Host "Backend nao respondeu em 60s. Logs:" -ForegroundColor Yellow
    docker compose logs backend --tail 40
    exit 1
}

Write-Host "Backend OK" -ForegroundColor Green

# Garante que os usuarios de demo existem com hash correto,
# mesmo que o volume do postgres tenha vindo de uma execucao antiga.
# Escreve o SQL num arquivo temporario em ASCII (pra evitar UTF-16 do
# PowerShell), copia pro container e executa via psql -f.
Write-Step "Garantindo usuarios de demo (admin + cliente)"
$sql = @'
INSERT INTO users (email, password_hash, full_name, role, status)
VALUES ('admin@vilavest.com.br',
        '$2b$12$bDCncc1B2U13vEZTxlacFu/.rwwa4Un3fNLktZn8KGaBemA.vRYsm',
        'Administrador VilaVest', 'admin', 'active')
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      status = EXCLUDED.status;

INSERT INTO users (email, password_hash, full_name, phone, role, status)
VALUES ('cliente@vilavest.com.br',
        '$2b$12$kun1Uo6iGGG5w3rlrum.cO8U7F0il5aV.Q4P6n0OselWFydHs0yOW',
        'Cliente Demo', '+5511998877665', 'customer', 'active')
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      status = EXCLUDED.status;

SELECT email, role, status, substring(password_hash, 1, 20) AS hash_prefix FROM users WHERE email IN ('admin@vilavest.com.br','cliente@vilavest.com.br');
'@
$tmpSql = Join-Path $env:TEMP "vilavest-seed-users.sql"
[System.IO.File]::WriteAllText($tmpSql, $sql, [System.Text.UTF8Encoding]::new($false))

docker compose cp $tmpSql postgres:/tmp/seed-users.sql | Out-Null
$out = docker compose exec -T postgres psql -U vilavest -d vilavest -v ON_ERROR_STOP=1 -f /tmp/seed-users.sql 2>&1
Write-Host $out
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha ao aplicar seed de usuarios (exit=$LASTEXITCODE)" -ForegroundColor Red
    exit 1
}
Write-Host "Usuarios de demo OK" -ForegroundColor Green

if ($Smoke) {
    Write-Step "Smoke tests"

    Write-Host "[GET] /health"
    Invoke-RestMethod -Uri "http://localhost:8080/health" | ConvertTo-Json -Compress | Write-Host

    Write-Host "[GET] /api/v1/products"
    $p = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/products?limit=3"
    Write-Host "Produtos retornados: $($p.data.Count) / total: $($p.total)"

    Write-Host "[POST] /api/v1/auth/login (admin)"
    $body = @{ email = "admin@vilavest.com.br"; password = "vilavest123!" } | ConvertTo-Json
    $login = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body $body -ContentType "application/json"
    Write-Host "Login OK, role: $($login.user.role)"
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  VilaVest esta no ar!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  Storefront : http://localhost:5173" -ForegroundColor Green
Write-Host "  API        : http://localhost:8080/api/v1" -ForegroundColor Green
Write-Host "  Health     : http://localhost:8080/health" -ForegroundColor Green
Write-Host ""
Write-Host "  Credenciais de teste:" -ForegroundColor Yellow
Write-Host "    admin@vilavest.com.br / vilavest123!" -ForegroundColor Yellow
Write-Host "    cliente@vilavest.com.br / cliente123!" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Dicas:" -ForegroundColor Gray
Write-Host "    .\run.ps1 -Logs   (ver logs)" -ForegroundColor Gray
Write-Host "    .\run.ps1 -Reset  (recomecar do zero)" -ForegroundColor Gray
Write-Host "    .\run.ps1 -Stop   (parar)" -ForegroundColor Gray
