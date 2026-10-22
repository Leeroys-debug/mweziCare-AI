resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
  tags       = local.common_tags
}

resource "random_password" "db" {
  length  = 32
  special = false
}

# Full connection string as a single secret (rather than separately
# interpolating host/user/password in the ECS task definition) — ECS's
# `secrets` block injects one Secrets Manager value per env var as-is, with
# no templating, so the combined string has to be built here instead.
resource "aws_secretsmanager_secret" "database_url" {
  name = "${local.name_prefix}/database-url"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgres://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${var.db_name}"
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name_prefix}-postgres"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage = var.db_allocated_storage_gb
  storage_encrypted = true
  kms_key_id        = aws_kms_key.main.arn

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  multi_az                 = true
  db_subnet_group_name     = aws_db_subnet_group.main.name
  vpc_security_group_ids   = [aws_security_group.rds.id]
  backup_retention_period  = 7
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-postgres-final"

  # [REVIEW REQUIRED] CLAUDE.md requires PostGIS, pgvector, and pgcrypto.
  # RDS Postgres supports all three via `CREATE EXTENSION` once the
  # instance exists (run as part of the release-step migration, same as
  # infra/postgres/init/01-extensions.sql does locally) — but this hasn't
  # been verified against a real RDS instance in this account/region, and
  # pgvector support is version-gated (needs a sufficiently recent Postgres
  # 16 minor version). Confirm both before the first real `terraform apply`.
  tags = local.common_tags
}
