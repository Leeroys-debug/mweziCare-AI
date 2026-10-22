resource "aws_kms_key" "main" {
  description             = "${local.name_prefix} — RDS storage encryption and the app's own field-level encryption key (see docs/security.md's key-rotation procedure for the latter)."
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = local.common_tags
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name_prefix}"
  target_key_id = aws_kms_key.main.key_id
}
