# 🚀 VilaVest — Guia de Deploy

Guia passo a passo para subir a aplicação em ambientes **dev** e **prod** usando **100% free tier**.

## 📐 Arquitetura de deploy

```
  ┌─────────────────────────┐      ┌─────────────────────────┐
  │         VERCEL          │      │          FLY.IO         │
  │   React SPA (frontend)  │◄────►│   Go API (backend)      │
  │   CDN global + HTTPS    │      │   Docker, região GRU    │
  └─────────────────────────┘      └────────────┬────────────┘
                                                │
                                                ▼
                                     ┌─────────────────────────┐
                                     │          NEON           │
                                     │   Postgres serverless   │
                                     │   branch: main / dev    │
                                     └─────────────────────────┘
```

| Ambiente | Frontend                                    | Backend (API)                                    | DB (Neon branch) |
|----------|---------------------------------------------|--------------------------------------------------|------------------|
| **dev**  | `dev.vilavest.leonardoflores.dev.br`        | `api-dev.vilavest.leonardoflores.dev.br`         | `dev`            |
| **prod** | `vilavest.leonardoflores.dev.br`            | `api.vilavest.leonardoflores.dev.br`             | `main` (prod)    |

Gatilhos de deploy:

- Push em `develop` → deploy automático no ambiente **dev**
- Push em `main` → deploy automático no ambiente **prod**

---

## 🪜 Passo 1 — Git: subir o repositório inicial

Abra o **PowerShell** na pasta `C:\Users\Leonardo Flores\Documents\Projetos\VilaVest` e rode:

```powershell
git push -u origin main
git checkout -b develop
git push -u origin develop
```

> O `git init`, commit inicial e `remote` já foram feitos no passo anterior — você só precisa autenticar e dar push. O protocolo está configurado como **SSH**, que já foi autenticado pelo `gh auth login`.

**Para "pullar" em outra máquina depois:**

```bash
git clone git@github.com:Leonardo-Flores/vilavest.git
cd vilavest
```

Se a outra máquina ainda não tem chave SSH configurada: `gh auth login` resolve tudo (instala cli, gera chave, envia pro GitHub).

---

## 🪜 Passo 2 — Neon (Postgres free tier)

1. Acesse [neon.tech](https://neon.tech) e faça login com GitHub.
2. Clique em **Create project**:
   - **Project name**: `vilavest`
   - **Region**: `AWS São Paulo (sa-east-1)` (mais próximo do Brasil)
   - **Postgres version**: 16
3. Após criar, o Neon mostra a **connection string** da branch `main` (produção). Copie e guarde — ela parece assim:
   ```
   postgres://user:pass@ep-xxxxx-pooler.sa-east-1.aws.neon.tech/vilavest?sslmode=require
   ```
4. **Criar branch de dev** (isolamento de dados):
   - Menu lateral → **Branches** → **Create branch**
   - Nome: `dev`
   - Parent: `main`
   - Copie a connection string desse branch também.
5. **Rodar as migrations** em ambas as branches:
   - Na aba **SQL Editor** do Neon, selecione a branch `main`, cole o conteúdo de `migrations/001_initial_schema.sql` e execute.
   - Repita selecionando a branch `dev`.

✅ Você agora tem dois DBs isolados: `DATABASE_URL_PROD` e `DATABASE_URL_DEV`.

---

## 🪜 Passo 3 — Fly.io (backend free tier)

### 3.1 Instalar o `flyctl`

No PowerShell (Windows):

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

Feche e reabra o terminal para o `PATH` ser atualizado. Teste: `flyctl version`.

### 3.2 Criar conta + login

```powershell
flyctl auth signup   # ou: flyctl auth login
```

> Fly.io pede cartão de crédito mesmo no free tier — é só pra prevenir fraude. O free inclui **3 VMs shared-cpu-1x 256MB**, que cabem dev + prod sem cobrar.

### 3.3 Criar os dois apps

A partir da pasta `backend/`:

```powershell
cd backend

# DEV
flyctl apps create vilavest-api-dev --org personal

# PROD
flyctl apps create vilavest-api-prod --org personal
```

### 3.4 Configurar secrets em cada app

**DEV:**

```powershell
flyctl secrets set --app vilavest-api-dev `
  DATABASE_URL="postgres://...neon.../vilavest?sslmode=require&options=endpoint%3Dep-xxx" `
  JWT_SECRET="$(New-Guid)"
```

> ⚠️ Use a URL do **branch dev** do Neon. Para o `JWT_SECRET`, qualquer string forte e aleatória serve.

**PROD:**

```powershell
flyctl secrets set --app vilavest-api-prod `
  DATABASE_URL="postgres://...neon.../vilavest?sslmode=require" `
  JWT_SECRET="$(New-Guid)$(New-Guid)"
```

### 3.5 Primeiro deploy manual (pra validar)

```powershell
# Ainda em backend/
flyctl deploy --config fly.dev.toml --remote-only
flyctl deploy --config fly.prod.toml --remote-only
```

Ao terminar, teste o health-check:

```powershell
curl https://vilavest-api-dev.fly.dev/health
curl https://vilavest-api-prod.fly.dev/health
```

Deve retornar `{"status":"ok","service":"vilavest-api","version":"1.0.0"}`.

### 3.6 Gerar token para CI/CD

```powershell
flyctl tokens create deploy --name github-actions --expiry 0 --app vilavest-api-prod
flyctl tokens create deploy --name github-actions --expiry 0 --app vilavest-api-dev
```

Você pode criar um único token org-scoped em vez disso:

```powershell
flyctl tokens create org --name github-actions --expiry 0
```

Copie o token — ele só aparece uma vez.

---

## 🪜 Passo 4 — Vercel (frontend free tier)

### 4.1 Importar o repo

1. Acesse [vercel.com](https://vercel.com) → **Login com GitHub**.
2. **Add New → Project** → selecione `Leonardo-Flores/vilavest`.
3. **Configure Project:**
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (já no `vercel.json`)
   - **Output Directory**: `dist`
4. **Environment Variables** (clique em "Environment Variables"):

   | Key | Value | Environment |
   |---|---|---|
   | `VITE_API_URL` | `https://api.vilavest.leonardoflores.dev.br/api/v1`     | Production |
   | `VITE_API_URL` | `https://api-dev.vilavest.leonardoflores.dev.br/api/v1`  | Preview |
   | `VITE_API_URL` | `https://api-dev.vilavest.leonardoflores.dev.br/api/v1`  | Development |

5. Clique em **Deploy**. Em ~1min sua URL padrão (`vilavest.vercel.app`) está no ar.

### 4.2 Configurar branch → ambiente no Vercel

- Project Settings → **Git** → **Production Branch**: `main`
- Branches diferentes de `main` viram "Preview Deployments" automaticamente. Em particular, `develop` vira um Preview fixo.

### 4.3 Alias fixo pro preview `develop`

Project Settings → **Domains** → adicione `dev.vilavest.leonardoflores.dev.br` apontando pra branch `develop`:

- Add Domain → `dev.vilavest.leonardoflores.dev.br` → **Git Branch**: `develop`.

---

## 🪜 Passo 5 — DNS no Registro.br (leonardoflores.dev.br)

Acesse o painel do Registro.br → domínio `leonardoflores.dev.br` → **DNS** → **Registros** e crie:

| Tipo  | Nome                                          | Valor                                           | TTL  |
|-------|-----------------------------------------------|-------------------------------------------------|------|
| CNAME | `vilavest.leonardoflores.dev.br`              | `cname.vercel-dns.com.`                         | 3600 |
| CNAME | `dev.vilavest.leonardoflores.dev.br`          | `cname.vercel-dns.com.`                         | 3600 |
| CNAME | `api.vilavest.leonardoflores.dev.br`          | `vilavest-api-prod.fly.dev.`                    | 3600 |
| CNAME | `api-dev.vilavest.leonardoflores.dev.br`      | `vilavest-api-dev.fly.dev.`                     | 3600 |

> ⚠️ O Registro.br exige ponto final (`.`) no valor dos CNAMEs. A Vercel fornece o CNAME exato quando você adiciona o domínio; use o valor que ela mostrar.

No **Vercel**, em Project → Settings → Domains, adicione:

- `vilavest.leonardoflores.dev.br` → Production (`main`)
- `dev.vilavest.leonardoflores.dev.br` → Preview branch `develop`

No **Fly.io**, registre os domínios customizados para gerar certificados SSL:

```powershell
flyctl certs create api.vilavest.leonardoflores.dev.br --app vilavest-api-prod
flyctl certs create api-dev.vilavest.leonardoflores.dev.br --app vilavest-api-dev
```

Vercel e Fly emitem certificados SSL grátis via Let's Encrypt automaticamente (propagação em minutos).

---

## 🪜 Passo 6 — CI/CD via GitHub Actions

### 6.1 Adicionar secret do Fly no GitHub

No navegador, vá em:

```
https://github.com/Leonardo-Flores/vilavest/settings/secrets/actions
```

Clique em **New repository secret**:

- **Name**: `FLY_API_TOKEN`
- **Value**: (o token gerado no passo 3.6)

### 6.2 Ambientes (opcional mas recomendado)

Em `Settings → Environments`, crie um env chamado **production** e exija aprovação manual antes de cada deploy — dá segurança extra.

### 6.3 Testar o pipeline

```powershell
# Ambiente dev
git checkout develop
git commit --allow-empty -m "ci: test dev deploy"
git push

# Ambiente prod (via PR develop → main, ou direto)
git checkout main
git merge develop
git push
```

Acompanhe em `https://github.com/Leonardo-Flores/vilavest/actions`.

---

## ✅ Checklist final

- [ ] Repo pushado pra GitHub (`main` + `develop`)
- [ ] Projeto Neon com branches `main` e `dev` + migrations aplicadas
- [ ] Apps Fly criados (`vilavest-api-dev`, `vilavest-api-prod`) com secrets
- [ ] Primeiro deploy manual bem-sucedido (`/health` retorna ok)
- [ ] Projeto Vercel importado + env `VITE_API_URL` configurada
- [ ] Domínios `vilavest.leonardoflores.dev.br` e `dev.vilavest.leonardoflores.dev.br` apontando pro Vercel
- [ ] Domínios `api.vilavest.leonardoflores.dev.br` e `api-dev.vilavest.leonardoflores.dev.br` com certs no Fly
- [ ] `FLY_API_TOKEN` adicionado aos secrets do GitHub
- [ ] Push em `develop` dispara deploy dev; push em `main` dispara deploy prod

---

## 🧰 Comandos úteis

```bash
# Ver logs do backend em tempo real
flyctl logs --app vilavest-api-dev

# Abrir shell no container
flyctl ssh console --app vilavest-api-dev

# Scale up / down
flyctl scale count 1 --app vilavest-api-prod
flyctl scale count 0 --app vilavest-api-dev        # pausa a máquina

# Ver secrets atuais
flyctl secrets list --app vilavest-api-prod

# Rollback rápido
flyctl releases list --app vilavest-api-prod
flyctl releases rollback <version> --app vilavest-api-prod

# Rodar SQL direto no Neon
# Use o SQL Editor em console.neon.tech
```

---

## 💰 Custo estimado

| Serviço | Free tier | Quando começa a cobrar |
|---|---|---|
| **Vercel** | Hobby: 100 GB bandwidth/mês, CDN global, builds ilimitados | Tráfego acima do limite ou uso comercial intenso |
| **Fly.io** | 3 VMs shared-cpu-1x 256MB, 160GB out/mês | VMs extras, regiões adicionais, volumes |
| **Neon** | 1 projeto, 3 GB armazenamento, branching, 100 horas compute/mês | Projetos/ramos adicionais ou compute > 100h |
| **GitHub Actions** | 2000 min/mês (privado) ou ilimitado (público) | Minutos extras |

Enquanto for teste/MVP, **tudo fica em $0**. Quando a loja começar a ter tráfego real, o primeiro ponto de upgrade costuma ser o Fly.io ($1.94/mês por VM extra ou $5/mês mínimo pra prod sempre ligado).
