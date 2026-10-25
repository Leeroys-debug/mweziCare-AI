# All other app secrets (everything except DATABASE_URL, which rds.tf
# builds and stores on its own) as one JSON-valued secret, referenced by
# ECS task definitions via the `arn:...:AUTH_SECRET::` JSON-key syntax.
#
# The actual VALUES are intentionally not set here — Terraform state/plan
# output must never contain real secrets. Populate this secret's JSON value
# out of band (AWS console, `aws secretsmanager put-secret-value`, or a
# separate access-restricted pipeline) with every key ecs.tf's task
# definitions reference:
#   AUTH_SECRET, AI_GATEWAY_API_KEY, ENCRYPTION_KEYS,
#   ENCRYPTION_KEY_ID, HMAC_LOOKUP_KEY, ANALYTICS_KEY, SENTRY_DSN
resource "aws_secretsmanager_secret" "app" {
  name = "${local.name_prefix}/app-secrets"
  tags = local.common_tags
}
