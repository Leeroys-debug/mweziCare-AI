# Clinician-summary PDFs — mirrors apps/web/lib/object-storage.ts's 7-day
# lifecycle rule (also enforced independently by the app's own retention
# job, worker/jobs/retention.ts, per SHARE_LINK_RETENTION_DAYS — see
# docs/security.md).
resource "aws_s3_bucket" "summaries" {
  bucket = "${local.name_prefix}-summaries"
  tags   = local.common_tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "summaries" {
  bucket = aws_s3_bucket.summaries.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.main.arn
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "summaries" {
  bucket = aws_s3_bucket.summaries.id
  rule {
    id     = "expire-after-7-days"
    status = "Enabled"
    filter {}
    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "summaries" {
  bucket                  = aws_s3_bucket.summaries.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
