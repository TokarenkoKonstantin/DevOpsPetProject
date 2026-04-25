resource "null_resource" "install_docker" {
  connection {
    type        = "ssh"
    host        = var.vps_host
    user        = var.vps_user
    private_key = file(var.ssh_key_path)
  }

  provisioner "remote-exec" {
    inline = [
      "apt-get update -q",
      "apt-get install -y docker.io docker-compose",
      "systemctl enable docker",
      "systemctl start docker",
      "echo 'Docker installed'"
    ]
  }
}
