#!/usr/bin/env bash
# One-time Garage bootstrap for local dev: assigns the single-node cluster
# layout, imports a fixed dev access key/secret (matching .env's
# S3_ACCESS_KEY/S3_SECRET_KEY), and creates+grants the summaries bucket.
# Safe to re-run: layout/key/bucket-create steps tolerate already being
# done; the final `bucket allow` always re-applies permissions.
#
# Run after `docker compose up -d garage`: `pnpm storage:init`
set -euo pipefail

# Git Bash (MSYS) otherwise rewrites leading-slash args like `/garage` into
# a Windows path before they reach `docker exec`.
export MSYS_NO_PATHCONV=1

CONTAINER="${GARAGE_CONTAINER:-mwezicareai-garage-1}"
ACCESS_KEY="GK5eb64026e220127625db8902"
SECRET_KEY="57be0cdd2ca907f9d91ca8c1e74f63f4bfdf210ebd61cf2c0a7ab0b353bb6d30"
BUCKET="mwezicare-summaries"

run() {
  docker exec "$CONTAINER" /garage "$@"
}

echo "Waiting for garage to be healthy..."
for _ in $(seq 1 20); do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "missing")
  [ "$status" = "healthy" ] && break
  sleep 1
done

NODE_ID=$(run status 2>/dev/null | grep -A2 'HEALTHY NODES' | tail -1 | awk '{print $1}')
if [ -z "$NODE_ID" ]; then
  echo "Could not determine Garage node ID — is the garage container running? (docker compose up -d garage)" >&2
  exit 1
fi
echo "Node ID: $NODE_ID"

run layout assign "$NODE_ID" -z dc1 -c 1G || true
run layout apply --version 1 || true
run key import "$ACCESS_KEY" "$SECRET_KEY" -n mwezicare --yes || true
run bucket create "$BUCKET" || true
run bucket allow --read --write "$BUCKET" --key "$ACCESS_KEY"

echo "Garage ready: bucket '$BUCKET' accessible with access key $ACCESS_KEY."
