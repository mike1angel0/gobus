# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy api package files
COPY apps/api/package.json apps/api/

# Install all dependencies (including devDeps for build)
RUN npm ci --workspace=apps/api --include-workspace-root

# Copy prisma schema and generate client
COPY apps/api/prisma apps/api/prisma
RUN npm run db:generate --workspace=apps/api

# Copy api source
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src

# Build TypeScript
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

# Copy prisma schema and regenerate client for production
COPY apps/api/prisma apps/api/prisma
RUN npm run db:generate --workspace=apps/api

# Copy built output from builder
COPY --from=builder /app/apps/api/dist apps/api/dist

# Copy entrypoint script
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Non-root user for security
RUN addgroup -S transio && adduser -S transio -G transio
USER transio

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/server.js"]
