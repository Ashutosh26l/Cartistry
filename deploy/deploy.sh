#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/var/www/ecommerce"
DEPLOY_DIR="$ROOT_DIR/deploy"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.prod.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed on EC2."
  exit 1
fi

cd "$DEPLOY_DIR"
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans
docker image prune -f >/dev/null 2>&1 || true

echo "Deployment completed successfully."
