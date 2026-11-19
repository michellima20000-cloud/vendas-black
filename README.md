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

## 🔗 Endpoints principais
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/v1/health` | Healthcheck |
| `GET` | `/api/v1/docs` | Swagger UI |
| `POST` | `/api/v1/auth/login` | Login |
| `POST` | `/api/v1/auth/register` | Cadastro |
| `GET` | `/api/v1/stores/public/:slug` | Loja pública |
| `GET` | `/api/v1/products/public/:storeSlug` | Produtos |
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
