resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  tags               = local.common_tags
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name_prefix}-web-tg"
  port        = var.web_container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  # /api/v1/health/status checks DB connectivity and queue status — see
  # apps/web/app/api/v1/health/status/route.ts and docs/deploy.md.
  health_check {
    path                = "/api/v1/health/status"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
  }
  tags = local.common_tags
}

# [REVIEW REQUIRED] Plain HTTP only — an HTTPS listener needs an ACM
# certificate ARN, which needs a Route53 (or externally-issued) domain that
# doesn't exist yet. Add `aws_lb_listener.https` with `certificate_arn`
# once a domain is chosen (docs/deploy.md), and change this listener to a
# redirect-to-HTTPS action instead of forwarding directly.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port               = 80
  protocol           = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}
