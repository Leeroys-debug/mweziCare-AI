output "alb_dns_name" {
  description = "Point a CNAME at this (or use it directly) until a real domain + ACM certificate exist."
  value       = aws_lb.main.dns_name
}

output "rds_address" {
  value     = aws_db_instance.main.address
  sensitive = true
}

output "ecr_web_repository_url" {
  value = aws_ecr_repository.web.repository_url
}

output "ecr_worker_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "summaries_bucket_name" {
  value = aws_s3_bucket.summaries.bucket
}

output "kms_key_arn" {
  value = aws_kms_key.main.arn
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "app_secrets_arn" {
  description = "Populate this secret's JSON value out of band before the first deploy — see secrets.tf."
  value       = aws_secretsmanager_secret.app.arn
}
