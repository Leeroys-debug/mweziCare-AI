# Declares the secret inputs consumed by main.tf's user_data template.
# SSM Parameter Store was the original plan (see main.tf's top comment for
# why that's not possible with this AWS credential) — these go into
# user_data directly instead, a real but accepted step down in isolation.
#
# Values come from TF_VAR_* environment variables set just before `apply`,
# never written to a .tfvars file. terraform.tfstate DOES still contain
# them in plaintext (this module has no remote/encrypted backend) — that
# file stays local and gitignored; never commit it.

variable "postgres_user" {
  type      = string
  sensitive = true
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

variable "postgres_db" {
  type      = string
  sensitive = true
}

variable "auth_secret" {
  type      = string
  sensitive = true
}

variable "ai_gateway_api_key" {
  type      = string
  sensitive = true
}

variable "encryption_keys_json" {
  type      = string
  sensitive = true
}

variable "encryption_key_id" {
  type      = string
  sensitive = true
}

variable "hmac_lookup_key" {
  type      = string
  sensitive = true
}

variable "analytics_key" {
  type      = string
  sensitive = true
}

# Garage (S3-compatible) is only reachable on the docker-compose internal
# network, never published to the host — these match infra/garage's
# bootstrap.sh so the same bucket/key setup works unchanged here.
variable "s3_access_key" {
  type      = string
  sensitive = true
}

variable "s3_secret_key" {
  type      = string
  sensitive = true
}

