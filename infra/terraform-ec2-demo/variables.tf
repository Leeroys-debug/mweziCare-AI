# Single-VM, AWS-Free-Tier-eligible deployment for demo purposes only — NOT
# the production target. Production uses ../terraform (Fargate + ALB + RDS),
# which is not free-tier eligible. This is a deliberately separate, simpler
# stack: one t3.micro running the existing docker-compose.prod.yml (web +
# worker + Postgres + Garage all on one box), reachable over plain HTTP.
#
# us-east-1 (not af-south-1, unlike ../terraform) because EC2 Free Tier
# burstable instance eligibility is unambiguous there — this is a temporary
# demo host, so Cape Town latency doesn't matter.

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "mwezicare-demo"
}

variable "instance_type" {
  description = "Free Tier eligible for the first 12 months of a new AWS account; billed at normal on-demand rates after that or on an older account."
  type        = string
  default     = "t3.micro"
}
