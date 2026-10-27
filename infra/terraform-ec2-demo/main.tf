data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

# The myride-deploy IAM user has broad ec2:* rights (it already manages the
# VPC/ALB/NAT in ../terraform) but NO iam:* or ssm:* rights at all — creating
# a role, instance profile, or SSM parameter is denied outright. So: no SSM
# Session Manager (that needs an instance role), SSH via a key pair instead;
# and no SSM Parameter Store for secrets, they go into user_data instead.
# Tradeoff: user_data (and therefore the secrets in it) is readable by
# anyone with `ec2:GetConsoleOutput`/`DescribeInstanceAttribute` on this AWS
# account — not public, but a real step down from Parameter Store, which
# only this instance's own role could have read. Rotate these secrets (or
# tear the instance down) once the demo is no longer needed.
resource "aws_security_group" "demo" {
  name        = "${var.project}-sg"
  description = "Demo host: HTTP app port + SSH (no IAM role available for SSM Session Manager)."
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Next.js app"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_key_pair" "demo" {
  key_name   = "${var.project}-key"
  public_key = file("${path.module}/mwezicare-demo-key.pub")
}

resource "aws_eip" "demo" {
  domain = "vpc"
  tags   = { Name = "${var.project}-eip" }
}

resource "aws_instance" "demo" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.demo.id]
  key_name               = aws_key_pair.demo.key_name

  root_block_device {
    volume_type = "gp3"
    volume_size = 20 # within the 30GB-month Free Tier allowance
  }

  # See the top-of-file comment: secrets live here (not SSM Parameter
  # Store) because this credential has no iam:*/ssm:* rights. Readable via
  # `aws ec2 get-console-output`/instance-attribute APIs by anyone with API
  # access to this AWS account — not public, but weaker than Parameter
  # Store would have been.
  user_data = templatefile("${path.module}/setup.sh.tpl", {
    postgres_user        = var.postgres_user
    postgres_password    = var.postgres_password
    postgres_db          = var.postgres_db
    auth_secret          = var.auth_secret
    ai_gateway_api_key   = var.ai_gateway_api_key
    encryption_keys_json = var.encryption_keys_json
    encryption_key_id    = var.encryption_key_id
    hmac_lookup_key      = var.hmac_lookup_key
    analytics_key        = var.analytics_key
    s3_access_key        = var.s3_access_key
    s3_secret_key        = var.s3_secret_key
    next_public_app_url  = "http://${aws_eip.demo.public_ip}:3000"
  })

  tags = { Name = var.project }
}

resource "aws_eip_association" "demo" {
  instance_id   = aws_instance.demo.id
  allocation_id = aws_eip.demo.id
}
