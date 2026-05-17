# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Generate Prisma client before compiling TypeScript
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# pg_dump is needed for the backup scheduler
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client openssl && rm -rf /var/lib/apt/lists/*

# Only copy what's needed to run
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/prisma        ./prisma
COPY package*.json ./

RUN mkdir -p backups

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
