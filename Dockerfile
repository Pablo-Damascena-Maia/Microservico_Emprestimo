# ─── Estágio de build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate

# ─── Imagem final ─────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src          ./src
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/package.json ./package.json

EXPOSE 9500

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:9500/health || exit 1

CMD ["node", "src/server.js"]
