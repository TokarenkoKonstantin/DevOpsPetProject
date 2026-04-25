output "vps_ip" {
  description = "IP адрес VPS"
  value       = var.vps_host
}

output "app_url" {
  description = "URL приложения"
  value       = "http://${var.vps_host}:3000"
}
