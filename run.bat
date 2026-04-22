@echo off
REM Wrapper .bat para rodar o run.ps1 mesmo com ExecutionPolicy bloqueado.
REM Uso:  run.bat            (build + up)
REM       run.bat -Reset     (apaga volumes)
REM       run.bat -Logs      (logs)
REM       run.bat -Stop      (para)
REM       run.bat -Smoke     (teste rapido)

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
