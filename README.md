# Vendas Black — API Back-End

API REST do sistema de e-commerce multi-tenant **Vendas Black**.

## 🚀 Stack
- **NestJS 10** + TypeScript 5
- **Prisma 5** + PostgreSQL 15
- **Redis** + BullMQ (filas)
- **Swagger/OpenAPI** em `/api/v1/docs`
- **MinIO** para storage de imagens
- **Nodemailer** + Mailhog para emails

## 📂 Estrutura
```
src/
├── auth/          # JWT, login, registro
├── users/         # Gestão de usuários
├── stores/        # Lojas (CRUD, tema)
├── products/      # Produtos e categorias
├── orders/        # Pedidos
├── uploads/       # Upload de imagens (MinIO)
├── health/        # Healthcheck
└── database/      # PrismaService
prisma/
└── schema.prisma  # Schema completo do banco
```

## 🛠️ Setup local

```bash
cp .env.example .env
# Edite .env com suas configurações
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

## 🐳 Docker Compose (infra completa)
Use o `docker-compose.yml` em `/infra` para subir tudo.

## ☁️ Deploy no Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/michellima20000-cloud/vendas-black)

O repositório já tem `render.yaml` (Blueprint) e `Dockerfile` prontos.

### Opção 1 — Script (mais rápido)

Precisa de uma API Key do Render: https://dashboard.render.com/u/settings#api-keys

```powershell
$env:RENDER_API_KEY = "rnd_xxxxxxxx"

# Cria Postgres + Web Service (Docker) e dispara o deploy.
.\scripts\deploy-render.ps1 -FrontendUrl "https://vendas-front.onrender.com" -Wait
```

O script é idempotente: se o banco/serviço já existirem, ele reaproveita, atualiza
as variáveis e redeploya. Ele configura `NODE_ENV`, `JWT_SECRET`, `FRONTEND_URL`
e `DATABASE_URL` automaticamente. Para upload de imagens, defina
`BLOB_READ_WRITE_TOKEN` (Vercel Blob, produção) ou as variáveis `MINIO_*`
(dev local) — veja `.env.example`.

### Opção 2 — Blueprint (dashboard)

1. No Render, escolha **New → Blueprint** e aponte para este repositório.
2. Preencha `FRONTEND_URL` com a URL do front publicado (ex.: `https://vendas-front.onrender.com`).
3. Preencha `BLOB_READ_WRITE_TOKEN` (Vercel Blob) ou as variáveis `MINIO_*` (MinIO, Cloudflare R2, Backblaze B2 etc.) se for usar upload de imagens. Sem elas a API sobe, mas o upload responde 503 com mensagem clara.
4. O health check deve ser `GET /api/v1/health/live`.

**Serviço manual (Docker):**
- Environment: `Docker`
- Dockerfile: `./Dockerfile`
- Health Check Path: `/api/v1/health/live`
- Variáveis mínimas: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
- As migrations rodam automaticamente no start do container (`prisma migrate deploy`).

**Serviço manual (Node):**
- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npm run start:deploy` (roda as migrations antes de subir)
- Node 20+

### Primeiro acesso depois do deploy

O banco começa vazio. Crie a primeira loja pela API:

1. `POST /api/v1/auth/register` → devolve o token (role `CUSTOMER`).
2. `POST /api/v1/stores` com `Authorization: Bearer <token>` e o corpo
   `{ "slug": "minha-loja", "name": "Minha Loja" }` → o usuário vira `STORE_OWNER`.
3. A loja pública fica em `/api/v1/stores/public/minha-loja`.

### Limitações do plano free (importante)

- **O Postgres free expira em 30 dias** e depois tem 14 dias de carência antes de
  ser apagado. Para produção, suba o banco para um plano pago antes do vencimento.
- O Web Service hiberna após 15 min sem tráfego; a primeira requisição leva ~1 min.
- O filesystem é efêmero: uploads precisam de storage externo (Vercel Blob, R2/B2/MinIO).
- Portas SMTP (25/465/587) são bloqueadas no plano free.


## 🔗 Endpoints principais
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/v1/health` | Healthcheck |
| `GET` | `/api/v1/docs` | Swagger UI |
| `POST` | `/api/v1/auth/login` | Login |
| `POST` | `/api/v1/auth/register` | Cadastro |
| `GET` | `/api/v1/stores/public/:slug` | Loja pública |
| `GET` | `/api/v1/products/public/:storeSlug` | Produtos |
| `GET` | `/api/v1/products/mine/categories` | Categorias da minha loja |
| `POST` | `/api/v1/products/mine/categories` | Criar categoria |
| `POST` | `/api/v1/uploads/images` | Upload de até 20 imagens |
| `POST` | `/api/v1/orders` | Criar pedido |

## 🔐 Variáveis de ambiente
Veja `.env.example` para todas as variáveis necessárias.

## 📋 Scripts
```bash
npm run start:dev    # Dev com hot-reload
npm run build        # Build de produção
npm run prisma:migrate  # Rodar migrations
npm run prisma:studio   # Prisma Studio (GUI)
```
