@echo off
REM Bateria de smoke tests contra a API do VilaVest.
REM Requer que os containers estejam rodando (run.bat).

echo.
echo === GET /health ===
curl -s http://localhost:8080/health
echo.
echo.
echo === GET /api/v1/products (storefront) ===
curl -s "http://localhost:8080/api/v1/products?limit=3"
echo.
echo.
echo === GET /api/v1/categories ===
curl -s http://localhost:8080/api/v1/categories
echo.
echo.
echo === POST /api/v1/auth/login (admin) ===
curl -s -X POST http://localhost:8080/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@vilavest.com.br\",\"password\":\"vilavest123!\"}"
echo.
echo.
echo === POST /api/v1/auth/login (cliente) ===
curl -s -X POST http://localhost:8080/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"cliente@vilavest.com.br\",\"password\":\"cliente123!\"}"
echo.
echo.
echo Se os JSONs acima aparecerem preenchidos, a API esta OK.
echo Abra http://localhost:5173 no navegador para testar o storefront.
