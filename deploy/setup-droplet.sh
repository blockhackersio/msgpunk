#!/usr/bin/env bash
set -euo pipefail

DROPLET_IP="${1:?Usage: $0 <droplet-ip>}"

echo "=== Updating packages ==="
ssh "root@$DROPLET_IP" bash -s <<'ROOT'
  set -euo pipefail

  apt-get update && apt-get upgrade -y

  echo "=== Installing Docker ==="
  if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
  fi

  echo "=== Creating deploy user ==="
  id -u deploy &>/dev/null || useradd -m -s /bin/bash deploy
  usermod -aG docker deploy
  mkdir -p /home/deploy/msgpunk

  echo "=== Setting up firewall ==="
  ufw --force enable
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp

  echo "=== Droplet base setup complete ==="
ROOT

echo "=== Copying docker-compose and Caddyfile ==="
scp msgpunk-server/deploy/docker-compose.yml "deploy@$DROPLET_IP:/home/deploy/msgpunk/"
scp msgpunk-server/deploy/Caddyfile "deploy@$DROPLET_IP:/home/deploy/msgpunk/"

echo ""
echo "=== Done! ==="
echo ""
echo "On the droplet, you still need to:"
echo ""
echo "  1. SSH into the droplet: ssh deploy@$DROPLET_IP"
echo "  2. Create .env with your repo (e.g. your-org/msgpunk-server):"
echo "     echo 'GITHUB_REPOSITORY=your-org/msgpunk-server' > /home/deploy/msgpunk/.env"
echo ""
echo "  3. Start the stack:"
echo "     cd /home/deploy/msgpunk && docker compose up -d"
echo ""
echo "  4. If your GHCR package is private, also add GHCR_TOKEN=... to .env"
echo "     and run: cat .env | grep GHCR_TOKEN | cut -d= -f2 | docker login ghcr.io -u <user> --password-stdin"
echo ""
echo "Watchtower will auto-deploy new images within 5 minutes of each push to master."
echo "Point your domain's DNS A record to $DROPLET_IP — Caddy handles TLS automatically."
