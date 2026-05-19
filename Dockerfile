# ─── Estágio de build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala todas as dependências (inclusive as devDependencies necessárias para o prisma)
RUN npm i

# Copia a pasta do prisma ANTES para gerar o client
COPY prisma ./prisma/

# Gera o Prisma Client explicitamente
ENV DATABASE_URL="mysql://placeholder:placeholder@placeholder:3306/placeholder"
RUN npx prisma generate

# Copia o restante do código fonte
COPY . .

# Em vez de 'npm prune', reinstalamos apenas a produção em uma pasta limpa para blindar o Prisma
RUN rm -rf node_modules && npm ci --omit=dev && npx prisma generate

# ─── Imagem final ──────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copia os arquivos necessários do estágio builder
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/src           ./src
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/package.json  ./package.json

EXPOSE 9500

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:9500/health || exit 1

CMD ["node", "src/server.js"]