FROM node:20-alpine AS base
WORKDIR /app
# Prisma needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY package*.json ./

EXPOSE 3001

# Migrations run on every boot (idempotent). If they fail, the API still
# starts so /api/v1/health/live can respond and the error appears in logs.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy || echo 'AVISO: migrate deploy falhou'; node dist/main"]
