# ─── Frontend Dockerfile (Desarrollo) ─────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=development
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

CMD ["npm", "run", "dev"]
