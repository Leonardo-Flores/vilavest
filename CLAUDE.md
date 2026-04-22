# VilaVest — Guia de Contexto para Claude

Este arquivo documenta a arquitetura, infraestrutura e convenções do projeto VilaVest para que qualquer sessão futura do Claude tenha contexto completo e siga os mesmos padrões.

## Visão Geral

VilaVest é um e-commerce de moda (monolito modular) com backend em Go e frontend em React. O projeto está em produção.

- **Dono:** Leonardo Flores (leonardo.flores@berzerk.com.br)
- **Repo:** https://github.com/Leonardo-Flores/vilavest (privado)
- **Domínio:** leonardoflores.dev.br (Registro.br)

## Stack Técnica

- **Backend:** Go 1.22, Chi router v5, JWT (golang-jwt), bcrypt, pgx v5
- **Frontend:** React 18, Vite 5, Tailwind CSS 3.4, Recharts, Axios, Lucide React
- **Banco:** PostgreSQL 16 (Neon serverless, região sa-east-1)
- **Containerização:** Docker multi-stage (alpine)

## Infraestrutura de Produção

| Serviço | Provedor | Plano | Região |
|---------|----------|-------|--------|
| Frontend | Vercel (Hobby) | Free | Global CDN |
| Backend API | Fly.io | Free tier | GRU (São Paulo) |
| Banco de dados | Neon | Free | sa-east-1 (São Paulo) |
| DNS | Registro.br | — | — |
| CI/CD | GitHub Actions | Free | — |

## URLs e Domínios

### Produção (branch: main)
- **Loja:** https://vilavest.leonardoflores.dev.br
- **API:** https://api.vilavest.leonardoflores.dev.br
- **Fly app:** vilavest-api-prod
- **Neon branch:** production
- **Vercel env:** Production

### Dev/Preview (branch: develop)
- **Loja:** https://dev.vilavest.leonardoflores.dev.br
- **API:** https://api-dev.vilavest.leonardoflores.dev.br
- **Fly app:** vilavest-api-dev
- **Neon branch:** dev
- **Vercel env:** Preview

### DNS (Registro.br — 4 CNAMEs)
```
vilavest.leonardoflores.dev.br         CNAME  cname.vercel-dns.com.
dev.vilavest.leonardoflores.dev.br     CNAME  cname.vercel-dns.com.
api.vilavest.leonardoflores.dev.br     CNAME  vilavest-api-prod.fly.dev.
api-dev.vilavest.leonardoflores.dev.br CNAME  vilavest-api-dev.fly.dev.
```

## Fluxo de Deploy (CI/CD)

O deploy é 100% automatizado via GitHub Actions + Vercel:

1. **Push em `develop`** → Deploy automático:
   - Vercel: deploy preview em dev.vilavest.leonardoflores.dev.br
   - Fly.io: workflow `deploy-backend-dev.yml` builda e deploya em vilavest-api-dev

2. **Push em `main`** → Deploy automático:
   - Vercel: deploy production em vilavest.leonardoflores.dev.br
   - Fly.io: workflow `deploy-backend-prod.yml` builda e deploya em vilavest-api-prod

3. **CI (em ambos):** workflow `ci.yml` roda lint + build do backend (Go) e frontend (Vite)

### Secrets configurados
- **GitHub Actions:** `FLY_API_TOKEN` (org-scoped, sem expiração)
- **Fly.io (cada app):** `DATABASE_URL`, `JWT_SECRET`
- **Vercel:** `VITE_API_URL` (Production → api.vilavest..., Preview → api-dev.vilavest...)

## Estrutura do Projeto

```
VilaVest/
├── .github/workflows/     # CI/CD (ci.yml, deploy-backend-dev.yml, deploy-backend-prod.yml)
├── backend/
│   ├── cmd/api/main.go    # Entry point
│   ├── internal/
│   │   ├── config/        # Configuração via env vars
│   │   ├── database/      # Conexão PostgreSQL (pgx pool)
│   │   ├── domain/        # Domínios (cada um com model + repo + handler)
│   │   │   ├── audit/     # Audit logs
│   │   │   ├── cart/      # Carrinho
│   │   │   ├── category/  # Categorias
│   │   │   ├── metrics/   # Dashboard admin (KPIs, gráficos)
│   │   │   ├── notification/ # Notificações
│   │   │   ├── order/     # Pedidos
│   │   │   ├── product/   # Produtos + estoque
│   │   │   ├── shipment/  # Envio + rastreio
│   │   │   ├── upload/    # Upload de imagens
│   │   │   └── user/      # Auth (JWT), perfil, RBAC
│   │   ├── httpx/         # Helpers HTTP
│   │   ├── middleware/     # JWT, RBAC, rate limit, audit, logger
│   │   └── router/        # Montagem de rotas (Chi)
│   ├── Dockerfile          # Multi-stage (builder + alpine runtime)
│   ├── fly.dev.toml        # Config Fly.io dev
│   ├── fly.prod.toml       # Config Fly.io prod
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── components/    # Header, Footer, ProductCard, AdminLayout, ImageUpload, ProtectedRoute
│   │   ├── context/       # AuthContext (JWT + localStorage), CartContext
│   │   ├── pages/
│   │   │   ├── admin/     # Dashboard, Products, Orders, Users, Categories, Audit
│   │   │   ├── auth/      # Login, Register
│   │   │   └── storefront/# Home, ProductDetail, Cart, Checkout, Orders, Tracking, Account
│   │   ├── services/api.js # Axios client com interceptors (11 API groups)
│   │   └── utils/format.js # Formatadores (moeda, data)
│   ├── vercel.json         # Build config + rewrites + security headers
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── infra/
│   ├── Dockerfile.backend  # Alternativo
│   └── Dockerfile.frontend # Nginx + Vite build
├── migrations/
│   ├── 001_initial_schema.sql  # 17 tabelas, enums, triggers, indexes
│   └── 002_seed_data.sql       # Categorias, produtos, users de teste
├── docker-compose.yml      # Dev local (postgres + backend + frontend)
├── DEPLOYMENT.md           # Guia completo de deploy passo a passo
├── LOCAL.md                # Guia para rodar localmente
└── README.md
```

## Convenções Importantes

### Backend (Go)
- Padrão de domínio: cada pasta em `internal/domain/` contém model, repository (SQL direto com pgx) e handler no mesmo arquivo
- Autenticação: JWT com HS256, token no header `Authorization: Bearer <token>`
- Roles: `customer`, `manager`, `admin` — middleware `RequireRole` para RBAC
- Rate limiting: 120 req/min por IP (go-chi/httprate)
- Audit log: middleware automático registra todas as ações
- CORS: configurado via env vars `FRONTEND_URL` e `ALLOWED_ORIGINS`
- Health check: `GET /health` retorna `{"status":"ok","service":"vilavest-api","version":"1.0.0"}`

### Frontend (React)
- SPA com react-router-dom v6, rotas protegidas via ProtectedRoute
- API client centralizado em `services/api.js` com 11 grupos de endpoints
- Auth: token em localStorage (`vilavest_token`), interceptor de 401 redireciona para /login
- CSS: @import de fontes DEVE vir ANTES dos @tailwind directives no index.css
- Build: Vite 5, output em `dist/`
- Sem package-lock.json commitado — usa `npm install` (não `npm ci`)

### Deploy
- NUNCA usar `npm ci` na Vercel ou CI — usar `npm install` (vercel.json já está configurado)
- Fly.io usa `auto_stop_machines = "stop"` para economizar free tier
- DATABASE_URL no Fly NUNCA deve conter `channel_binding=require` — remover esse parâmetro
- Certificados SSL dos domínios customizados no Fly foram criados via `flyctl certs create`
- Neon branches: `production` (prod) e `dev` (dev) — connection strings diferentes

### Git
- Branch `main` = produção
- Branch `develop` = desenvolvimento
- Commits seguem conventional commits (feat:, fix:, chore:, ci:)
- Deploy automático em push (não precisa rodar flyctl manualmente)

## Credenciais de Teste (Produção)

- **Admin:** admin@vilavest.com.br / vilavest123!
- **Cliente:** cliente@vilavest.com.br / cliente123!
- Senhas foram resetadas via pgcrypto no Neon (o hash original do seed era inválido)

## Troubleshooting Comum

1. **Login falha:** Hash bcrypt pode estar inválido. Resetar via Neon SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   UPDATE users SET password_hash = crypt('nova_senha', gen_salt('bf', 10)) WHERE email = '...';
   ```

2. **Vercel build falha com npm ci:** Verificar que `vercel.json` tem `"installCommand": "npm install"` (não `npm ci`)

3. **API retorna SSL error no domínio custom:** Certificados Fly precisam ser criados:
   ```
   flyctl certs create api.vilavest.leonardoflores.dev.br --app vilavest-api-prod
   ```

4. **Fly app suspended:** Reativar com `flyctl scale count 1 --app vilavest-api-prod`

5. **Produtos não aparecem:** Verificar se `VITE_API_URL` está configurada na Vercel e apontando para a API correta

6. **Backend não conecta no Neon:** Verificar que DATABASE_URL NÃO tem `channel_binding=require`
