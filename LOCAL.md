# 🖥️ VilaVest — Rodando localmente

Guia pra subir a stack completa (Go API + Postgres + React) na sua máquina **antes** de configurar cloud/deploy.

---

## Pré-requisitos

- **Docker Desktop** rodando (Windows/Mac/Linux)
- Portas livres: `5173` (frontend), `8080` (API), `5432` (Postgres)

---

## 1. Subir tudo com um comando

Na raiz do projeto (`C:\Users\Leonardo Flores\Documents\Projetos\VilaVest`), no PowerShell:

```powershell
docker compose up --build
```

A primeira build baixa imagens Go, Node e Postgres, compila o binário e builda o bundle React. Demora **3–5 min**. Próximas builds ficam em segundos graças ao cache.

Logs que confirmam sucesso:

```
vilavest-db       | database system is ready to accept connections
vilavest-api      | {"level":"INFO","msg":"database connected","target":"postgres:5432/vilavest"}
vilavest-api      | {"level":"INFO","msg":"server listening","addr":"0.0.0.0:8080"}
vilavest-web      | Configuration complete; ready for start up
```

---

## 2. Acessar

| Serviço | URL |
|---|---|
| **Loja (storefront)** | http://localhost:5173 |
| **Admin** | http://localhost:5173/admin |
| **API · health** | http://localhost:8080/health |
| **API · produtos** | http://localhost:8080/api/v1/products |
| **Postgres** | `localhost:5432` user=`vilavest` pass=`vilavest_secret` db=`vilavest` |

A homepage já renderiza com **mock data** (categorias, produtos em destaque) — você não precisa ter cadastros pra ver o layout funcionando. O admin também abre sem login nesta fase inicial (auth desligado nas rotas).

---

## 3. Comandos úteis

```powershell
# Parar tudo (sem apagar dados)
docker compose down

# Parar e apagar volumes (zera o banco)
docker compose down -v

# Só o backend (mais rápido p/ iterar)
docker compose up --build backend

# Ver logs de um serviço
docker compose logs -f backend

# Rebuild forçado (útil depois de mudar Go / frontend)
docker compose build --no-cache backend
docker compose up backend
```

---

## 4. Modo desenvolvedor (hot reload)

Pra iterar rápido sem rebuild Docker a cada salvamento:

**Terminal 1 — Backend:**
```powershell
cd backend
go run ./cmd/api
```
> Requer Go 1.22 instalado. Use um Postgres rodando via `docker compose up postgres`.

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm install
npm run dev
```
> Vite já faz proxy `/api → http://localhost:8080`, então o frontend fala com o Go direto.

---

## 5. Testando endpoints manualmente

```powershell
# Health
curl http://localhost:8080/health

# Listar produtos (vazio até cadastrar)
curl http://localhost:8080/api/v1/products

# Registrar usuario
curl -X POST http://localhost:8080/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"admin@vilavest.local\",\"password\":\"senha1234\",\"full_name\":\"Admin\"}'
```

---

## 6. Problemas comuns

**`port is already allocated`**
Algum outro serviço usa 5173/8080/5432. Pare-os ou mude as portas em `docker-compose.yml`.

**Backend morre com `connection refused` na primeira subida**
O Postgres às vezes demora pra aceitar. O `depends_on: condition: service_healthy` já cobre isso na maioria dos casos. Se persistir:
```powershell
docker compose restart backend
```

**Frontend build falha em `npm ci`**
Você não commitou ainda o `package-lock.json`. Sem problema — o Dockerfile detecta e cai em `npm install`. Gere o lock localmente com `cd frontend && npm install` pra builds 100% reprodutíveis depois.

**Migrations não rodaram**
`docker-entrypoint-initdb.d` só roda na **primeira** subida do volume. Pra re-aplicar:
```powershell
docker compose down -v
docker compose up --build
```

---

Quando estiver tudo 👌 localmente, parte pro [DEPLOYMENT.md](./DEPLOYMENT.md) pra colocar no ar.
