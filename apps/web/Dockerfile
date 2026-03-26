# Stage 1: Build the Vite app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY spec/ spec/

# Install dependencies
RUN npm ci --workspace=@transio/web --include-workspace-root

# Copy web source
COPY apps/web/ apps/web/

# Build the SPA
RUN npm -w @transio/web run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
