#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/apps/api
npx prisma migrate deploy
cd /app

echo "Starting server..."
exec "$@"
