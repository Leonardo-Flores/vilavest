# 🏪 VilaVest — Modern E-Commerce Platform

<p align="center">
  <img src="frontend/public/logo.png" alt="VilaVest" width="200"/>
</p>

<p align="center">
  <strong>E-commerce moderno, performático e seguro — construído com Go + React</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.22-00ADD8?style=flat-square&logo=go" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square" />
</p>

<p align="center">
  <a href="./LOCAL.md">🖥️ Rodar local</a> ·
  <a href="./DEPLOYMENT.md">☁️ Guia de Deploy</a> ·
  <a href="https://vilavest.leonardoflores.dev.br">🌐 Produção (em breve)</a>
</p>

---

## 📐 Arquitetura

VilaVest segue o padrão **Monolito Modular**, separando responsabilidades por domínio sem a complexidade de microsserviços.

```
┌─────────────────────────────────────────────────┐
│                  API Gateway (Go)                │
│         Middleware: Auth · Audit · CORS          │
├──────┬──────┬──────┬──────┬──────┬──────────────┤
│ User │ Prod │ Cart │Order │Logis │ Notification  │
│  🧑  │  📦  │  🛒  │  📋  │  🚚  │      📧      │
├──────┴──────┴──────┴──────┴──────┴──────────────┤
│              PostgreSQL Database                 │
└─────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Pré-requisitos
- Docker & Docker Compose
- Go 1.22+ (para desenvolvimento local)
- Node.js 20+ (para desenvolvimento local)

### Executar com Docker

```bash
docker compose up --build
```

| Serviço   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:5173         |
| Backend   | http://localhost:8080         |
| Swagger   | http://localhost:8080/swagger |
| PostgreSQL| localhost:5432               |

### Desenvolvimento Local

```bash
# Backend
cd backend
go mod download
go run cmd/api/main.go

# Frontend
cd frontend
npm install
npm run dev
```

## 🏗️ Estrutura do Projeto

```
vilavest/
├── backend/
│   ├── cmd/api/              # Entrypoint da aplicação
│   │   └── main.go
│   ├── internal/
│   │   ├── config/           # Variáveis de ambiente
│   │   ├── database/         # Conexão e migrations
│   │   ├── domain/           # Módulos de negócio
│   │   │   ├── product/      # Catálogo & Estoque
│   │   │   ├── order/        # Pedidos & Checkout
│   │   │   ├── user/         # Autenticação & RBAC
│   │   │   ├── cart/         # Carrinho de compras
│   │   │   ├── logistics/    # Rastreio & Entregas
│   │   │   ├── notification/ # Emails & Alertas
│   │   │   └── audit/        # Logs de auditoria
│   │   ├── middleware/       # Auth, CORS, Audit, RateLimit
│   │   ├── router/           # Registro de rotas
│   │   └── swagger/          # Docs OpenAPI
│   ├── migrations/           # SQL migrations
│   └── docs/                 # Swagger gerado
├── frontend/
│   ├── src/
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── pages/            # Páginas (storefront + admin)
│   │   ├── hooks/            # Custom hooks
│   │   ├── services/         # API client (axios)
│   │   ├── context/          # React Context (Auth, Cart)
│   │   └── lib/              # Utilidades
│   └── public/
├── infra/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
└── README.md
```

## 🔒 Segurança

- **JWT Authentication** com refresh tokens
- **RBAC** (Role-Based Access Control): `admin`, `manager`, `customer`
- **Audit Logs** — toda alteração é rastreada com: usuário, ação, recurso, IP e timestamp
- **Rate Limiting** por IP
- **CORS** configurável
- **Input Sanitization** em todas as rotas
- **Prepared Statements** contra SQL Injection

## 📊 Painel Administrativo

- Dashboard com métricas de vendas (Recharts)
- Gestão de produtos e estoque
- Controle de pedidos e logística
- Gerenciamento de usuários com RBAC
- Visualização de Audit Logs

## 📡 API Documentation

A API segue o padrão RESTful com documentação Swagger/OpenAPI auto-gerada.

Cada domínio expõe seus endpoints via handlers que são auto-documentados com annotations do `swaggo/swag`:

```go
// @Summary      Listar produtos
// @Description  Retorna lista paginada de produtos
// @Tags         products
// @Produce      json
// @Param        page   query  int  false  "Página"  default(1)
// @Param        limit  query  int  false  "Limite"  default(20)
// @Success      200  {object}  PaginatedResponse[Product]
// @Router       /api/v1/products [get]
```

## 📄 Licença

Projeto proprietário — VilaVest © 2026. Todos os direitos reservados.
