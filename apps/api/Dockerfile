# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy api package files
COPY apps/api/package.json apps/api/

# Install all dependencies (including devDeps for build)
RUN npm ci --workspace=apps/api --include-workspace-root

# Copy prisma schema, config, and api source
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src

# Generate Prisma client (after src copy so it isn't overwritten)
RUN npm run db:generate --workspace=apps/api

# Build TypeScript (tsc compiles generated prisma .ts files into dist/)
RUN npm run build --workspace=apps/api

# ---- Runtime stage ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy root workspace config
COPY package.json package-lock.json ./

# Copy api package.json
COPY apps/api/package.json apps/api/

# Install production dependencies only
RUN npm ci --workspace=apps/api --include-workspace-root --omit=dev

# Copy built output (includes compiled prisma client in dist/generated/)
COPY --from=builder /app/apps/api/dist apps/api/dist

# Copy prisma schema and config (needed for migrate deploy at runtime)
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/

# Copy entrypoint script
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Non-root user for security
RUN addgroup -S transio && adduser -S transio -G transio
USER transio

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health/live || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/server.js"]
