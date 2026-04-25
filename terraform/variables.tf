variable "vps_host" {
  description = "IP адрес VPS сервера"
  type        = string
  default     = "64.188.79.192"
}

variable "vps_user" {
  description = "SSH пользователь"
  type        = string
  default     = "root"
}

variable "ssh_key_path" {
  description = "Путь до SSH ключа"
  type        = string
  default     = "~/.ssh/id_ed25519"
}

