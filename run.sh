#\!/usr/bin/env bash
# VilaVest — reinicia tudo do zero (Linux/macOS / Git Bash)
set -e
cd "$(dirname "$0")"

case "${1:-up}" in
  stop)    docker compose down ;;
  logs)    docker compose logs -f --tail 50 ;;
  reset)   docker compose down -v && docker compose build && docker compose up -d ;;
  up|*)    docker compose build && docker compose up -d ;;
esac

echo ""
echo "Aguardando backend em http://localhost:8080/health..."
for i in $(seq 1 30); do
  if curl -s -f http://localhost:8080/health >/dev/null 2>&1; then
    echo ""
    echo "=============================================="
    echo "  VilaVest esta no ar\!"
    echo "=============================================="
    echo "  Storefront : http://localhost:5173"
    echo "  API        : http://localhost:8080/api/v1"
    echo ""
    echo "  Credenciais:"
    echo "    admin@vilavest.com.br / vilavest123\!"
    echo "    cliente@vilavest.com.br / cliente123\!"
    exit 0
  fi
  printf "."
  sleep 2
done

echo ""
echo "Backend nao subiu em 60s. Logs:"
docker compose logs backend --tail 40
exit 1
