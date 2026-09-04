# Deploying msgpunk-server

## Prerequisites

- A server (e.g. DigitalOcean Droplet, VPS) with a public IP
- A domain name pointed at that IP (DNS A record)
- SSH access to the server

## Option 1: Docker Compose (recommended)

### 1. SSH into the server as root

```bash
ssh root@<your-server-ip>
```

### 2. Install Docker

```bash
apt-get update && apt-get upgrade -y
curl -fsSL https://get.docker.com | sh
```

### 3. Create the deploy user

```bash
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
mkdir -p /home/deploy/msgpunk
```

### 4. Configure the firewall

```bash
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
```

### 5. Copy deployment files to the server

From your local machine:

```bash
scp deploy/docker-compose.yml deploy@<your-server-ip>:/home/deploy/msgpunk/
scp deploy/Caddyfile deploy@<your-server-ip>:/home/deploy/msgpunk/
```

### 6. Configure your domain

SSH into the server and edit the Caddyfile:

```bash
ssh deploy@<your-server-ip>
cd ~/msgpunk
```

Replace `msgpunk.com` in `Caddyfile` with your domain:

```
{
    admin off
}

your-domain.com {
    reverse_proxy msgpunk-server:8080
}
```

### 7. Create the env file

```bash
echo 'MSGPUNK_DATA_DIR=/home/deploy/msgpunk/data' > .env
```

If using a private GHCR package, add your token (create a PAT at https://github.com/settings/tokens with `read:packages` scope):

```bash
echo 'GHCR_TOKEN=ghp_...' >> .env
cat .env | grep GHCR_TOKEN | cut -d= -f2 | docker login ghcr.io -u <your-username> --password-stdin
```

### 8. Start the stack

```bash
docker compose up -d
```

Caddy automatically provisions a TLS certificate from Let's Encrypt. Your server is live at `https://your-domain.com`.

### 9. Updating

Push to the `master` branch. Watchtower polls every 5 minutes and deploys the new image automatically.

---

## Option 2: Bare metal (systemd)

Build the binary and copy it to the server along with the systemd unit:

```bash
cargo build --release -p msgpunk-server
scp target/release/msgpunk-server deploy@<your-server-ip>:/home/deploy/msgpunk/
scp deploy/msgpunk-server.service deploy@<your-server-ip>:/home/deploy/msgpunk/
```

SSH into the server:

```bash
ssh deploy@<your-server-ip>
sudo cp ~/msgpunk/msgpunk-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now msgpunk-server
```

You'll also need to set up a reverse proxy (Caddy, nginx, etc.) on port 80/443 pointing to `localhost:8080`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MSGPUNK_DATA_DIR` | `.msgpunk/data` | Directory for stored data |
| `VITE_MSGPUNK_SERVER_URL` | `https://msgpunk.com` | Server URL used by the Tauri client (set at build time) |
