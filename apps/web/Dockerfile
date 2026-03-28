# Stage 1: Build the Vite app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY spec/ spec/

# Install dependencies
RUN npm ci --workspace=@gobus/web --include-workspace-root

# Copy web source
COPY apps/web/ apps/web/

# Build the SPA
RUN npm -w @gobus/web run build

# Stage 2: Serve with nginx (hardened)
FROM nginx:alpine

# Copy built assets and config
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Create writable directories for non-root nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /tmp/nginx.pid && \
    chown nginx:nginx /tmp/nginx.pid

# Remove default nginx user directive (we set it via config)
RUN sed -i 's/^user  nginx;/# user  nginx;/' /etc/nginx/nginx.conf && \
    sed -i 's|pid.*nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf

# Switch to non-root user
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
