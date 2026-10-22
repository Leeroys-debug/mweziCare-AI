resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name_prefix}-web"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name_prefix}-worker"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

locals {
  # `arn:...:secret-id:JSON_KEY::` is Secrets Manager's syntax for
  # injecting one key of a JSON-valued secret as a single ECS env var.
  app_secret_refs = {
    AUTH_SECRET              = "${aws_secretsmanager_secret.app.arn}:AUTH_SECRET::"
    AFRICASTALKING_USERNAME  = "${aws_secretsmanager_secret.app.arn}:AFRICASTALKING_USERNAME::"
    AFRICASTALKING_API_KEY   = "${aws_secretsmanager_secret.app.arn}:AFRICASTALKING_API_KEY::"
    AFRICASTALKING_SENDER_ID = "${aws_secretsmanager_secret.app.arn}:AFRICASTALKING_SENDER_ID::"
    AI_GATEWAY_API_KEY       = "${aws_secretsmanager_secret.app.arn}:AI_GATEWAY_API_KEY::"
    ENCRYPTION_KEYS          = "${aws_secretsmanager_secret.app.arn}:ENCRYPTION_KEYS::"
    ENCRYPTION_KEY_ID        = "${aws_secretsmanager_secret.app.arn}:ENCRYPTION_KEY_ID::"
    HMAC_LOOKUP_KEY          = "${aws_secretsmanager_secret.app.arn}:HMAC_LOOKUP_KEY::"
    ANALYTICS_KEY            = "${aws_secretsmanager_secret.app.arn}:ANALYTICS_KEY::"
    SENTRY_DSN               = "${aws_secretsmanager_secret.app.arn}:SENTRY_DSN::"
  }

  # Shared across web + worker — both run retention jobs' env-configured
  # windows and both need S3/KMS access (see iam.tf).
  common_app_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "S3_BUCKET", value = aws_s3_bucket.summaries.bucket },
    { name = "S3_REGION", value = var.aws_region },
    { name = "S3_ENDPOINT", value = "https://s3.${var.aws_region}.amazonaws.com" },
    { name = "CHAT_RETENTION_DAYS", value = "90" },
    { name = "SHARE_LINK_RETENTION_DAYS", value = "7" },
    { name = "ACCOUNT_PURGE_DAYS", value = "30" },
    { name = "AUDIT_RETENTION_DAYS", value = "365" },
  ]

  common_app_secrets = [
    for name, value_from in local.app_secret_refs : { name = name, valueFrom = value_from }
  ]
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name_prefix}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_task_cpu
  memory                   = var.web_task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name         = "web"
      image        = var.web_image
      essential    = true
      portMappings = [{ containerPort = var.web_container_port, protocol = "tcp" }]
      environment = concat(local.common_app_environment, [
        # [REVIEW REQUIRED] Replace with the real domain once chosen — the
        # ALB's own DNS name is a placeholder so this plans/applies cleanly
        # before a domain exists.
        { name = "NEXT_PUBLIC_APP_URL", value = "https://${aws_lb.main.dns_name}" },
      ])
      secrets = concat(local.common_app_secrets, [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      ])
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web"
        }
      }
    }
  ])
  tags = local.common_tags
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_task_cpu
  memory                   = var.worker_task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name        = "worker"
      image       = var.worker_image
      essential   = true
      environment = local.common_app_environment
      secrets = concat(local.common_app_secrets, [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      ])
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])
  tags = local.common_tags
}

# Not an aws_ecs_service — this one is invoked on demand as the release
# step ("migrations run separately, before the new version starts", F2
# spec), via `aws ecs run-task --task-definition <this family> --launch-type
# FARGATE ...` from CI/CD, then waited on before the web/worker services'
# task definitions are updated to the new image.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name_prefix}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_task_cpu
  memory                   = var.worker_task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "migrate"
      image     = var.worker_image
      essential = true
      # The worker image's WORKDIR is apps/web (Dockerfile's `worker`
      # target) — `--filter` runs this in packages/db instead, where
      # src/migrate.ts actually lives, regardless of image WORKDIR.
      command = ["pnpm", "--filter", "@mwezicare/db", "exec", "tsx", "src/migrate.ts"]
      # Only DATABASE_URL — the migration runner has no other dependency.
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "migrate"
        }
      }
    }
  ])
  tags = local.common_tags
}

resource "aws_ecs_service" "web" {
  name            = "${local.name_prefix}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_service.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = var.web_container_port
  }

  depends_on = [aws_lb_listener.http]
  tags       = local.common_tags
}

# No load balancer — the worker is a background pg-boss process, nothing
# inbound. Same image as web (built from the same Dockerfile's `worker`
# target), same cluster, separate service/task definition per F2's "same
# image, separate process" design.
resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_service.id]
  }

  tags = local.common_tags
}
