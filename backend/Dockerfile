# ─── Etapa de desarrollo (usada por docker-compose) ────────────────────────────
FROM node:20-alpine AS development

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copiar manifests primero para aprovechar el cache de capas de Docker
COPY package*.json ./
RUN npm ci

# Copiar el schema de Prisma y generar el cliente ANTES de copiar el resto
# Esto permite que la capa del cliente Prisma se cachee mientras el schema no cambie
COPY prisma ./prisma/
RUN npx prisma generate

# Copiar el resto del código fuente
COPY . .

# El comando real lo pone docker-compose (db push + start:dev)
CMD ["npm", "run", "start:dev"]


# ─── Etapa de build (compila TypeScript) ───────────────────────────────────────
FROM development AS builder
RUN npm run build


# ─── Etapa de producción ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/main.js"]
