#!/bin/bash
set -euo pipefail

dnf install -y docker git
systemctl enable --now docker
curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
mkdir -p /usr/libexec/docker/cli-plugins
ln -sf /usr/local/bin/docker-compose /usr/libexec/docker/cli-plugins/docker-compose

git clone --depth 1 https://github.com/Leeroys-debug/mweziCare-AI.git /opt/mwezicare
cd /opt/mwezicare

cat > .env <<'ENVEOF'
POSTGRES_USER=${postgres_user}
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=${postgres_db}
AUTH_SECRET=${auth_secret}
AI_GATEWAY_API_KEY=${ai_gateway_api_key}
ENCRYPTION_KEYS=${encryption_keys_json}
ENCRYPTION_KEY_ID=${encryption_key_id}
HMAC_LOOKUP_KEY=${hmac_lookup_key}
ANALYTICS_KEY=${analytics_key}
S3_ACCESS_KEY=${s3_access_key}
S3_SECRET_KEY=${s3_secret_key}
NEXT_PUBLIC_APP_URL=${next_public_app_url}
ENVEOF

docker compose -f docker-compose.prod.yml up -d --build

# docker compose's project name (and so each container's name) derives from
# the working directory's basename — "mwezicare" here, not "mwezicareai"
# like local dev's "mweziCare AI" folder — so bootstrap.sh needs the override.
GARAGE_CONTAINER=mwezicare-garage-1 bash infra/garage/bootstrap.sh > /var/log/garage-bootstrap.log 2>&1 || true
