# Free-tier demo deployment

A single `t3.micro` EC2 instance running `docker-compose.prod.yml` from the
repo root (web + worker + Postgres + Garage, all on one box). Separate from
`../terraform` (the real Fargate/ALB/RDS production target, which is **not**
free-tier eligible) — this exists purely to host a free demo during an AWS
account's first 12 months.

The deploying IAM user (`myride-deploy`) has broad `ec2:*` rights but no
`iam:*` or `ssm:*` rights at all, so two things that would otherwise be
preferred aren't available here:

- **No SSM Session Manager** (needs an instance IAM role) — access is via
  SSH instead, using a key pair generated locally and imported by
  `aws_key_pair.demo`. The private half never leaves the machine that ran
  `terraform apply` and is never committed.
- **No SSM Parameter Store for secrets** (`ssm:PutParameter` is denied) —
  secrets are instead interpolated into the instance's `user_data` by
  `setup.sh.tpl`. This is readable by anyone with
  `ec2:GetConsoleOutput`/`DescribeInstanceAttribute` on this AWS account —
  not public, but weaker isolation than Parameter Store would have given.
  Rotate these secrets (or tear the instance down) once the demo is no
  longer needed.

## Apply

Secrets are passed as `TF_VAR_*` environment variables, never written to a
`.tfvars` file — see `secrets.tf` for the full list.

```bash
ssh-keygen -t ed25519 -f ./mwezicare-demo-key -N "" -C mwezicare-demo
export TF_VAR_postgres_user=... # ...etc
terraform plan -out=demo.tfplan
terraform apply demo.tfplan
```

## After apply

`setup.sh.tpl` runs automatically at boot: installs Docker + Compose, clones
the repo, writes `.env`, runs `docker compose -f docker-compose.prod.yml up
-d --build`, then bootstraps the Garage bucket/key (`infra/garage/bootstrap.sh`,
with `GARAGE_CONTAINER` overridden since the compose project name here is
`mwezicare`, not `mwezicareai` like local dev).

SSH in with `ssh -i mwezicare-demo-key ec2-user@<public_ip>` to check on it
(`docker compose -f /opt/mwezicare/docker-compose.prod.yml ps`,
`/var/log/garage-bootstrap.log`, `/var/log/cloud-init-output.log`).
