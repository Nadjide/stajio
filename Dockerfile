# syntax=docker/dockerfile:1

# --- base: image commune avec les outils de build pour les modules natifs (better-sqlite3) ---
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./

# --- deps: dependances completes (necessaires pour le build Next.js) ---
FROM base AS deps
RUN npm ci

# --- prod-deps: dependances de production uniquement ---
FROM base AS prod-deps
RUN npm ci --omit=dev

# --- builder: compilation de l'application ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner: image finale, minimale, sans outils de build ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV STAJIO_DB_PATH=/app/data/stajio.db

RUN mkdir -p /app/data && chown -R node:node /app/data

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3001').then(()=>process.exit(0)).catch(()=>process.exit(1))"

CMD ["./node_modules/.bin/next", "start", "-p", "3001"]
