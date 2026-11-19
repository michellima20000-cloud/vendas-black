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

O repositório já tem `render.yaml` (Blueprint) e `Dockerfile` prontos.

**Via Blueprint (recomendado):**
1. No Render, escolha **New → Blueprint** e aponte para este repositório.
2. Preencha `FRONTEND_URL` com a URL do front publicado (ex.: `https://vendas-front.onrender.com`).
3. Preencha as variáveis `MINIO_*` se for usar upload de imagens (MinIO, Cloudflare R2, Backblaze B2 etc.). Sem elas a API sobe, mas o upload falha.
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

> No plano free o serviço hiberna após inatividade; a primeira requisição pode levar ~50s.

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
