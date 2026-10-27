output "instance_id" {
  value = aws_instance.demo.id
}

output "public_ip" {
  value = aws_eip.demo.public_ip
}

output "app_url" {
  value = "http://${aws_eip.demo.public_ip}:3000"
}
