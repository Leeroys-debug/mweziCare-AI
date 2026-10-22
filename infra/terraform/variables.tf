variable "aws_region" {
  description = "AWS region for the pilot deployment. Every resource below is parameterised by this — change it (and re-apply) if counsel requires hosting outside af-south-1; nothing is hardcoded to Cape Town."
  type        = string
  default     = "af-south-1"
}

variable "project" {
  description = "Short name used as a prefix for every resource's name/tags."
  type        = string
  default     = "mwezicare"
}

variable "environment" {
  description = "Deployment environment (e.g. staging, production) — used in resource naming/tagging. Run this module once per environment with a separate state file/workspace."
  type        = string
  default     = "staging"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "availability_zone_count" {
  description = "Number of AZs to spread subnets/NAT gateways across."
  type        = number
  default     = 2
}

variable "db_instance_class" {
  description = "[REVIEW REQUIRED] Not yet sized/approved by ops — a reasonable pilot-scale starting point, not a production recommendation."
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 50
}

variable "db_name" {
  type    = string
  default = "mwezicare"
}

variable "db_username" {
  type    = string
  default = "mwezicare"
}

variable "web_container_port" {
  type    = number
  default = 3000
}

variable "web_task_cpu" {
  description = "Fargate task CPU units (1024 = 1 vCPU)."
  type        = number
  default     = 512
}

variable "web_task_memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "worker_task_cpu" {
  type    = number
  default = 256
}

variable "worker_task_memory" {
  type    = number
  default = 512
}

variable "web_desired_count" {
  type    = number
  default = 2
}

variable "worker_desired_count" {
  type    = number
  default = 1
}

variable "web_image" {
  description = "Full ECR image URI (with tag or digest) for the web container — set per release by CI/CD (see docs/deploy.md), not a default here."
  type        = string
}

variable "worker_image" {
  description = "Full ECR image URI (with tag or digest) for the worker container — set per release by CI/CD, not a default here."
  type        = string
}

variable "log_retention_days" {
  type    = number
  default = 30
}
