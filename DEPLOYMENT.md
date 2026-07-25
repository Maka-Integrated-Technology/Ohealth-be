# OHealth — EC2 + Docker Deployment Guide

Deploy the OHealth NestJS API to AWS EC2 using Docker Compose and GitHub Actions CI/CD.

## How it works

- The API and PostgreSQL run as **Docker containers** defined in `docker-compose.prod.yml`.
- The app image is built from the multi-stage `Dockerfile`. **Database migrations run automatically** on container start (baked into the image's start command), so a deploy is just "pull code, rebuild, recreate container."
- **Nginx** sits in front as a reverse proxy and terminates TLS.
- **GitHub Actions** (`.github/workflows/deploy.yml`) SSHes into the box and runs the compose command on every push.

### One compose file, multiple environments

Staging and production share the **same** `docker-compose.prod.yml`. They are separated by:

- a distinct **compose project name** (`-p ohealth-staging` vs `-p ohealth-prod`) — this namespaces container, network, and volume names so the two stacks never collide;
- their own **`.env.prod`** file (different `PORT` and `POSTGRES_*` credentials).

> This guide documents both environments. You can run them on **separate instances** (recommended once production has real users) or **co-host both on one larger instance** (see [Running staging and production](#running-staging-and-production)). While OHealth is in development you may deploy **staging only** — just skip the production-specific steps.

---

## Prerequisites

- AWS account with EC2 access
- GitHub repository access (`git@github.com:Maka-Integrated-Technology/Ohealth-be.git`)
- Domain name (optional, can use the EC2 public IP)

---

## 1. Launch EC2 Instance

### Instance Configuration

| Setting       | Value                                                        |
| ------------- | ----------------------------------------------------------- |
| AMI           | Ubuntu 24.04 LTS                                            |
| Instance type | `t3.small` (single environment) / `t3.medium` (both on one box) |
| Storage       | 20 GiB gp3 (enable encryption under **Advanced** if desired) |
| Key pair      | Create or select an existing one                            |

### Security Group (Inbound Rules)

| Port | Protocol | Source    | Purpose                          |
| ---- | -------- | --------- | -------------------------------- |
| 22   | TCP      | 0.0.0.0/0 | SSH (needed for GitHub Actions)  |
| 80   | TCP      | 0.0.0.0/0 | HTTP                             |
| 443  | TCP      | 0.0.0.0/0 | HTTPS                            |

> **SSH source:** GitHub Actions runners use rotating IPs, so SSH must be reachable from anywhere for CI deploys to work. Keep it safe by relying on **key-only auth** — see [§3](#3-install-system-dependencies) for disabling password login.

> **Tip:** Assign an **Elastic IP** so the public IP doesn't change on reboot.

---

## 2. Connect to EC2

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 3. Install System Dependencies

The Docker path needs only Docker, git, and Nginx — no Node, PostgreSQL, or PM2 on the host.

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# git + Nginx
sudo apt install -y git nginx

# Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sudo sh

# Let the ubuntu user run docker without sudo (REQUIRED for GitHub Actions deploys)
sudo usermod -aG docker ubuntu

# Apply the new group in this shell (or just log out and back in)
newgrp docker

# Verify
docker --version && docker compose version && git --version && nginx -v
```

> Adding `ubuntu` to the `docker` group is **required**: the CI deploy runs `docker compose ...` as the `ubuntu` user without `sudo`. Without group membership the deploy fails with a permission error.

### Harden SSH (recommended, since port 22 is internet-facing)

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

---

## 4. Set Up SSH Key for GitHub (on the EC2 server)

This lets the server clone/pull the private repo over SSH.

### 4a. Generate the key

```bash
ssh-keygen -t ed25519 -C "ohealth-ec2" -f ~/.ssh/github_deploy -N ""
```

### 4b. Configure SSH to use it for GitHub

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config ~/.ssh/github_deploy
```

### 4c. Add the public key to GitHub

```bash
cat ~/.ssh/github_deploy.pub
```

Go to **GitHub → Repository → Settings → Deploy keys → Add deploy key**, title `ohealth-ec2`, paste the key, leave **Allow write access** unchecked.

### 4d. Test

```bash
ssh -T git@github.com
```

Expected: `Hi <username>! You've successfully authenticated, but GitHub does not provide shell access.`

---

## 5. Clone the Repository

Each environment lives in its own directory. The branch determines the environment.

```bash
sudo mkdir -p /var/www/ohealth/be
sudo chown -R ubuntu:ubuntu /var/www/ohealth

# Staging (staging branch)
git clone -b staging git@github.com:Maka-Integrated-Technology/Ohealth-be.git /var/www/ohealth/be/staging

# Production (main branch) — skip while staging-only
git clone -b main git@github.com:Maka-Integrated-Technology/Ohealth-be.git /var/www/ohealth/be/prod
```

---

## 6. Configure Environment Variables

Each environment directory gets its own `.env.prod`, copied from the template.

> **The file must be named `.env.prod`** — the deploy workflow passes `--env-file .env.prod`. This is the file Compose reads for `${VAR}` interpolation **and** injects into the app container.

### Staging

```bash
cd /var/www/ohealth/be/staging
cp .env.prod.example .env.prod
nano .env.prod
```

Fill in real values — at minimum:

```env
NODE_ENV=staging
PORT=3000

POSTGRES_USER=ohealth
POSTGRES_PASSWORD=<strong_password>
POSTGRES_DB=ohealth_staging_db

JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
```

Also set the mail, Cloudinary, Google, and OpenRouter values your build uses.

### Production (skip while staging-only)

```bash
cd /var/www/ohealth/be/prod
cp .env.prod.example .env.prod
nano .env.prod
```

Use `NODE_ENV=production`, a separate `POSTGRES_DB` (e.g. `ohealth_app_db`), and **different secrets**. If co-hosting with staging on one box, set `PORT=3001` for staging and keep `PORT=3000` for production so they don't collide.

---

## 7. First Manual Deploy

Migrations run automatically as the container starts, so this single command builds the image, starts PostgreSQL, applies migrations, and launches the API.

### Staging

```bash
cd /var/www/ohealth/be/staging
docker compose -p ohealth-staging --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### Production (skip while staging-only)

```bash
cd /var/www/ohealth/be/prod
docker compose -p ohealth-prod --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Verify (replace the port with your `PORT`):

```bash
docker compose -p ohealth-staging -f docker-compose.prod.yml ps
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/docs   # expect 200
```

---

## 8. Configure Nginx Reverse Proxy

Point Nginx at the container's published port (`PORT`).

### Staging

```bash
sudo nano /etc/nginx/sites-available/api.staging.ohealth
```

```nginx
server {
    listen 80;
    server_name api.staging.ohealthltd.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Production (skip while staging-only)

Same block as above, but `server_name api.ohealthltd.com;` and `proxy_pass http://127.0.0.1:3000;` (or `:3001` if staging is co-hosted on the same box).

### Enable

```bash
sudo ln -s /etc/nginx/sites-available/api.staging.ohealth /etc/nginx/sites-enabled/
# sudo ln -s /etc/nginx/sites-available/api.ohealth /etc/nginx/sites-enabled/   # production
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

---

## 9. Configure GitHub Actions Secrets

`deploy.yml` uses `appleboy/ssh-action` to SSH in and run the compose command. It deploys on push:

| Branch    | Deploys to                  | Compose project   |
| --------- | --------------------------- | ----------------- |
| `staging` | `/var/www/ohealth/be/staging`   | `ohealth-staging` |
| `main`    | `/var/www/ohealth/be/prod`  | `ohealth-prod`    |

### 9a. Generate a CI key on the server

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions   # copy this private key
```

### 9b. Add repository secrets

**GitHub → Repository → Settings → Secrets and variables → Actions**:

| Secret           | Value                                        |
| ---------------- | -------------------------------------------- |
| `SERVER_HOST`    | EC2 public IP (or Elastic IP)                |
| `SERVER_USER`    | `ubuntu`                                      |
| `SERVER_SSH_KEY` | Contents of `~/.ssh/github_actions` (private) |

Pushing to `staging` (or `main`) now triggers an automatic deploy. No changes to the workflow are needed.

---

## 10. DNS Setup

Get your public IP (`curl -s http://checkip.amazonaws.com`) and add **A records** at your DNS provider for `ohealthltd.com`:

| Type | Name          | Value             | TTL |
| ---- | ------------- | ----------------- | --- |
| A    | `api.staging` | `<EC2_PUBLIC_IP>` | 300 |
| A    | `api`         | `<EC2_PUBLIC_IP>` | 300 |

Verify:

```bash
nslookup api.staging.ohealthltd.com
```

---

## 11. SSL with Let's Encrypt (Optional)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.staging.ohealthltd.com   # add -d api.ohealthltd.com for production
```

Certbot auto-renews. Verify with `sudo certbot renew --dry-run`.

---

## Deployment Flow

```
dev (daily work)
  ↓ merge
staging → push → GitHub Actions → SSH into EC2 → docker compose up -d --build (ohealth-staging)
  ↓ merge
main → push → GitHub Actions → SSH into EC2 → docker compose up -d --build (ohealth-prod)
```

| Branch    | Purpose           | Deploys to       |
| --------- | ----------------- | ---------------- |
| `dev`     | Daily development | No auto-deploy   |
| `staging` | Testing / QA      | Staging stack    |
| `main`    | Production        | Production stack |

---

## Running staging and production

**Separate instances (recommended for live production).** Run each environment on its own EC2 box following this guide. A bad staging deploy, runaway query, or OOM can't affect production. Each box only runs one stack.

**Co-hosted on one instance (cost-saving, dev stage only).** Both stacks can share a host because the compose **project name** isolates their containers, networks, and volumes (`ohealth-staging_pg_data` vs `ohealth-prod_pg_data`). If you do this:

- Use a `t3.medium` (4 GB) — a `t3.small` will run out of memory under two apps + two databases + a build.
- Give staging `PORT=3001` and production `PORT=3000` so the published ports don't collide.
- Consider building images in CI and pulling them (instead of `--build` on the box) to avoid a staging build starving production of CPU.

Once production has real users, move it to its own instance.

---

## Manual Deployment

If you need to deploy without GitHub Actions (first deploy, hotfix, CI down):

```bash
# Staging
cd /var/www/ohealth/be/staging
git pull origin staging
docker compose -p ohealth-staging --env-file .env.prod -f docker-compose.prod.yml up -d --build

# Production
cd /var/www/ohealth/be/prod
git pull origin main
docker compose -p ohealth-prod --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

---

## Useful Commands

```bash
# Status / logs (pass the matching -p project name)
docker compose -p ohealth-staging -f docker-compose.prod.yml ps
docker compose -p ohealth-staging -f docker-compose.prod.yml logs -f app

# Restart just the app container
docker compose -p ohealth-staging -f docker-compose.prod.yml restart app

# Stop / remove the stack (keeps the DB volume)
docker compose -p ohealth-staging -f docker-compose.prod.yml down

# Reclaim space from old images
docker image prune -f

# Nginx
sudo nginx -t && sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Checklist

- [ ] EC2 instance launched with the security group above
- [ ] Docker + Compose plugin, git, Nginx installed
- [ ] `ubuntu` added to the `docker` group
- [ ] SSH password login disabled
- [ ] GitHub deploy key added; `ssh -T git@github.com` works
- [ ] Repo cloned to `/var/www/ohealth/be/staging` (and `/prod` if running production)
- [ ] `.env.prod` created in each environment directory with strong secrets
- [ ] First manual `docker compose up -d --build` succeeds; `/docs` returns 200
- [ ] Nginx reverse proxy configured and reloaded
- [ ] GitHub Actions key in `authorized_keys`; `SERVER_HOST` / `SERVER_USER` / `SERVER_SSH_KEY` secrets set
- [ ] DNS A records pointing at the instance
- [ ] SSL certificate installed (if using a domain)
