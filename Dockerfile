
# ─── Estágio de build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder
 
WORKDIR /app
 
# Instala OpenSSL necessário pelo Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
 
COPY package*.json ./
RUN npm ci --omit=dev
 
COPY . .
 
ENV DATABASE_URL="mysql://placeholder:placeholder@placeholder:3306/placeholder"
RUN npx prisma generate
 
# ─── Imagem final ──────────────────────────────────────────────────────────────
FROM node:22-slim
 
WORKDIR /app
 
# Instala OpenSSL na imagem final também
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
 
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/src           ./src
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/package.json  ./package.json
 
EXPOSE 9500
 
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:9500/health || exit 1
 
CMD ["node", "src/server.js"]
 