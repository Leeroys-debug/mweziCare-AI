# Terraform — AWS ECS Fargate pilot (F2)

Provisions the AWS side of `docs/deploy.md`'s "pilot" target: VPC, ALB, ECS Fargate (web + worker
services, same image as `apps/web/Dockerfile`'s `web`/`worker` targets), RDS PostgreSQL Multi-AZ, S3 for
clinician-summary PDFs, KMS for the storage/field-encryption key, Secrets Manager for everything else.

**This is a scaffold, not a reviewed, apply-ready stack.** It has not been run through
`terraform init/plan/apply` against a real AWS account — there was no Terraform CLI or AWS access in
the environment this was written in. Review every `[REVIEW REQUIRED]` comment in these files before a
real `terraform apply`, especially:

- `rds.tf` — PostGIS/pgvector/pgcrypto support hasn't been confirmed against a real RDS Postgres 16
  instance in this account/region.
- `alb.tf` — HTTP only; needs an ACM certificate + a real domain before this is internet-facing for
  real users.
- `variables.tf`'s `db_instance_class` and the Fargate `cpu`/`memory` defaults are unreviewed guesses,
  not ops-approved sizing.

## Layout

| File                 | What it provisions                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `network.tf`         | VPC, public/private subnets × `availability_zone_count`, NAT gateways, route tables        |
| `security_groups.tf` | ALB (80/443 from the internet), ECS (app port from the ALB only), RDS (5432 from ECS only) |
| `rds.tf`             | RDS PostgreSQL 16, Multi-AZ, encrypted, plus the `DATABASE_URL` secret                     |
| `s3.tf`              | The summaries bucket (KMS-encrypted, 7-day lifecycle, no public access)                    |
| `kms.tf`             | The shared key for RDS storage + the app's field-level encryption                          |
| `ecr.tf`             | `web`/`worker` image repositories                                                          |
| `secrets.tf`         | The `app-secrets` JSON secret (values populated out of band, never by Terraform)           |
| `iam.tf`             | ECS execution role (pull/log/read-secrets) and task role (S3 + KMS only)                   |
| `alb.tf`             | The load balancer, target group (health-checks `/api/v1/health/status`), HTTP listener     |
| `ecs.tf`             | The cluster, `web`/`worker`/`migrate` task definitions, `web`/`worker` services            |
| `outputs.tf`         | ALB DNS name, ECR repo URLs, bucket name, KMS key ARN, etc.                                |

## Usage

```bash
cd infra/terraform
terraform init
terraform plan \
  -var="web_image=<ecr-web-repo-url>:<tag>" \
  -var="worker_image=<ecr-worker-repo-url>:<tag>" \
  -var="environment=staging"
# Review the plan carefully. Do not `terraform apply` without separate,
# explicit sign-off — this provisions real, billable AWS resources.
```

Changing region (e.g. if counsel requires Kenyan-adjacent or other hosting instead of af-south-1) is a
single `-var="aws_region=..."` — nothing in these files hardcodes Cape Town.

## Release flow (migrations as a separate step)

1. Build and push new `web`/`worker` images to the ECR repos this module creates.
2. Run the `migrate` task definition to completion first: `aws ecs run-task --cluster <cluster> --task-definition <name_prefix>-migrate --launch-type FARGATE --network-configuration ...` and wait for it to exit 0.
3. Only then update the `web`/`worker` services to the new task definition revision (new image).

This mirrors `docker-compose.prod.yml`'s `migrate` service, which the same Dockerfile `migrate` target
also backs locally.

## What's deliberately NOT here

- A Route53 zone / ACM certificate — no domain has been chosen yet.
- CloudWatch alarms / autoscaling policies — not yet specified by ops.
- A CI/CD pipeline that actually calls `terraform apply` — that's a GitHub Actions (or similar) workflow
  to add once a real AWS account and approval process exist, not a Terraform concern.
