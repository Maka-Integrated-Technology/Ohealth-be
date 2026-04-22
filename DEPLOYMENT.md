# OHealth — EC2 Deployment Guide

Complete guide to deploy the OHealth NestJS API on AWS EC2 with GitHub Actions CI/CD.

## Prerequisites

- AWS account with EC2 access
- GitHub repository with SSH access
- Domain name (optional, can use EC2 public IP)

---

## 1. Launch EC2 Instance

### Instance Configuration

| Setting          | Value                          |
| ---------------- | ------------------------------ |
| AMI              | Ubuntu 24.04 LTS              |
| Instance type    | t3.small (2 vCPU, 2GB RAM)    |
| Storage          | 20GB gp3                      |
| Key pair         | Create or select an existing one |

### Security Group (Inbound Rules)

| Port | Protocol | Source    | Purpose        |
| ---- | -------- | --------- | -------------- |
| 22   | TCP      | Your IP   | SSH access     |
| 80   | TCP      | 0.0.0.0/0 | HTTP           |
| 443  | TCP      | 0.0.0.0/0 | HTTPS          |

> **Tip**: Assign an Elastic IP to your instance so the public IP doesn't change on reboot.

---

## 2. Connect to EC2

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 3. Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Verify installations
node -v && npm -v && psql --version && pm2 -v && nginx -v
```

---

## 4. Set Up SSH Key for GitHub (on the EC2 server)

This allows the server to clone your private repo via SSH and allows GitHub Actions to SSH into the server.

### 4a. Generate SSH Key on EC2

```bash
ssh-keygen -t ed25519 -C "ohealth-ec2" -f ~/.ssh/github_deploy -N ""
```

This creates:
- `~/.ssh/github_deploy` — private key (stays on server)
- `~/.ssh/github_deploy.pub` — public key (goes to GitHub)

### 4b. Configure SSH to Use This Key for GitHub

```bash
nano ~/.ssh/config
```

Add:

```
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    IdentitiesOnly yes
```

Set permissions:

```bash
chmod 600 ~/.ssh/config
chmod 600 ~/.ssh/github_deploy
chmod 644 ~/.ssh/github_deploy.pub
```

### 4c. Add the Public Key to GitHub

Print the public key:

```bash
cat ~/.ssh/github_deploy.pub
```

Then go to **GitHub → Repository → Settings → Deploy keys → Add deploy key**:
- **Title**: `ohealth-ec2`
- **Key**: Paste the public key output
- **Allow write access**: Leave unchecked (read-only is fine for pulling)

### 4d. Test the Connection

```bash
ssh -T git@github.com
```

Expected output:
```
Hi <your-username>! You've successfully authenticated, but GitHub does not provide shell access.
```

---

## 5. Set Up PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER ohealth WITH PASSWORD '<strong_password>';
CREATE DATABASE ohealth_app_db OWNER ohealth;
GRANT ALL PRIVILEGES ON DATABASE ohealth_app_db TO ohealth;
\q
```

---

## 6. Prepare Branches (one-time setup from local machine)

The `staging` and `main` branches are the deployment branches. Your working code lives on `dev`, so you need to merge it into both before deploying.

Run this from your **local machine**:

```bash
# Merge dev into staging
git checkout staging
git merge dev
git push origin staging

# Merge dev into main
git checkout main
git merge dev
git push origin main

# Switch back to dev for daily work
git checkout dev
```

### Going forward

- **Daily development** → push to `dev`
- **Ready to test** → merge `dev` into `staging`, push → auto-deploys to staging server
- **Ready for production** → merge `staging` into `main`, push → auto-deploys to production server

---

## 7. Clone the Repository on EC2 (via SSH)

### If previously cloned (via HTTPS), remove and reclone

```bash
# Stop any running PM2 processes first
pm2 stop all 2>/dev/null
pm2 delete all 2>/dev/null

# Remove old clones
rm -rf /var/www/healthbridge/be/prod
rm -rf /var/www/healthbridge/be/dev
```

### Clone fresh via SSH

```bash
sudo mkdir -p /var/www/healthbridge/be
sudo chown -R ubuntu:ubuntu /var/www/healthbridge

# Production (main branch)
git clone -b main git@github.com:healthBridge01/healthBridge-be.git /var/www/healthbridge/be/prod

# Staging (staging branch)
git clone -b staging git@github.com:healthBridge01/healthBridge-be.git /var/www/healthbridge/be/dev
```

### Verify remote is SSH and correct branch

```bash
cd /var/www/healthbridge/be/prod
git remote -v
git branch

cd /var/www/healthbridge/be/dev
git remote -v
git branch
```

Expected:
- `/prod` → `origin git@github.com:healthBridge01/healthBridge-be.git`, branch `* main`
- `/dev` → `origin git@github.com:healthBridge01/healthBridge-be.git`, branch `* staging`

> If you don't want to reclone, you can switch an existing clone from HTTPS to SSH:
> ```bash
> git remote set-url origin git@github.com:healthBridge01/healthBridge-be.git
> ```

---

## 8. Configure Environment Variables

### Production

```bash
nano /var/www/healthbridge/be/prod/.env
```

```env
NODE_ENV=production
PORT=3000
APP_NAME=OHealth
APP_SLUG=ohealth
APP_DESCRIPTION=OHealth Application

DB_HOST=localhost
DB_PORT=5432
DB_NAME=ohealth_app_db
DB_USER=ohealth
DB_PASS=<your_db_password>
DB_SSL=false

JWT_SECRET=<run: openssl rand -hex 32>
JWT_REFRESH_SECRET=<run: openssl rand -hex 32>
TOKEN_ACCESS_DURATION=15m
TOKEN_REFRESH_DURATION=7d

HASH_SALT=10
INVITE_EXPIRATION_DAYS=7
```

### Staging

```bash
cp /var/www/healthbridge/be/prod/.env /var/www/healthbridge/be/dev/.env
nano /var/www/healthbridge/be/dev/.env
```

Change in staging:
```env
NODE_ENV=staging
PORT=3001
DB_NAME=ohealth_staging_db
```

> Create the staging database too if you want isolation:
> ```bash
> sudo -u postgres psql -c "CREATE DATABASE ohealth_staging_db OWNER ohealth;"
> ```

---

## 9. First Manual Deploy

```bash
cd /var/www/healthbridge/be/prod
npm ci --production=false
npm run build
npm run migration:run

# Start with PM2
pm2 start dist/src/main.js --name hb-api-prod
pm2 save

# Enable PM2 to start on reboot
pm2 startup
# Run the command it outputs (starts with sudo env PATH=...)
```

Verify it's running:
```bash
curl http://localhost:3000/docs
```

---

## 10. Configure Nginx Reverse Proxy

### Production

```bash
sudo nano /etc/nginx/sites-available/api.healthbridge
```

```nginx
server {
    listen 80;
    server_name api.ohealthltd.com;

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

### Staging

```bash
sudo nano /etc/nginx/sites-available/api.staging.healthbridge
```

```nginx
server {
    listen 80;
    server_name api.staging.ohealthltd.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
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

### Enable both sites

```bash
sudo ln -s /etc/nginx/sites-available/api.healthbridge /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.staging.healthbridge /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 11. Configure GitHub Actions Secrets

Your CI pipeline uses `appleboy/ssh-action` to SSH into the server. Using SSH key auth (recommended over password).

### 11a. Generate a Separate Key for GitHub Actions

On the EC2 server:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions -N ""
```

Authorize it to SSH into the server:

```bash
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
```

Print the private key (you'll paste this into GitHub):

```bash
cat ~/.ssh/github_actions
```

### 11b. Add Secrets to GitHub

Go to **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**:

| Secret             | Value                                          |
| ------------------ | ---------------------------------------------- |
| `SERVER_HOST`      | Your EC2 public IP (or Elastic IP)             |
| `SERVER_USER`      | `ubuntu`                                       |
| `SERVER_SSH_KEY`   | Contents of `~/.ssh/github_actions` (private key) |

### 11c. Update the CI Pipeline to Use SSH Key

Update `.github/workflows/ci-pipeline.yml` — replace `password` with `key` in both deploy jobs:

```yaml
  deploy-staging:
    needs: ci
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging' && github.event_name == 'push'

    steps:
      - name: Deploy to Staging
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /var/www/healthbridge/be/dev
            git pull origin staging
            npm ci --production=false
            npm run build
            npm run migration:run
            pm2 restart hb-api-staging || pm2 start dist/src/main.js --name hb-api-staging
            pm2 save

  deploy-production:
    needs: ci
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - name: Deploy to Production
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /var/www/healthbridge/be/prod
            git pull origin main
            npm ci --production=false
            npm run build
            npm run migration:run
            pm2 restart hb-api-prod || pm2 start dist/src/main.js --name hb-api-prod
            pm2 save
```

---

## 12. DNS Setup

### Get Your EC2 Public IP

From the **AWS Console**: EC2 → Instances → select your instance → Details tab → **Public IPv4 address**

Or run on the EC2 server:

```bash
curl -s http://checkip.amazonaws.com
```

> **Important**: Assign an **Elastic IP** so the public IP doesn't change on reboot:
> EC2 → Elastic IPs → Allocate Elastic IP address → Associate to your instance.

### Configure DNS Records

Go to your domain hosting provider (wherever `ohealthltd.com` is registered) and add these **A records**:

| Type | Name          | Value            | TTL |
| ---- | ------------- | ---------------- | --- |
| A    | `api`         | `<EC2_PUBLIC_IP>` | 300 |
| A    | `api.staging` | `<EC2_PUBLIC_IP>` | 300 |

This maps:
- `api.ohealthltd.com` → your EC2 instance (production)
- `api.staging.ohealthltd.com` → your EC2 instance (staging)

### Verify DNS Propagation

```bash
nslookup api.ohealthltd.com
nslookup api.staging.ohealthltd.com
```

Both should resolve to your EC2 public IP. DNS propagation can take up to 24 hours but usually completes within minutes.

---

## 13. SSL with Let's Encrypt (Optional)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.ohealthltd.com -d api.staging.ohealthltd.com
```

Certbot auto-renews. Verify with:
```bash
sudo certbot renew --dry-run
```

---

## Deployment Flow

```
dev (daily work)
  ↓ merge
staging → push → GitHub Actions CI → SSH into EC2 → deploy to /dev (port 3001)
  ↓ merge
main → push → GitHub Actions CI → SSH into EC2 → deploy to /prod (port 3000)
```

### Branch Strategy

| Branch    | Purpose              | Deploys To                          |
| --------- | -------------------- | ----------------------------------- |
| `dev`     | Daily development    | No auto-deploy                      |
| `staging` | Testing/QA           | `/var/www/healthbridge/be/dev` :3001 |
| `main`    | Production           | `/var/www/healthbridge/be/prod` :3000 |

---

## Manual Deployment

If you need to deploy without going through GitHub Actions (e.g. first deploy, hotfix, or CI is down).

### Staging

```bash
cd /var/www/healthbridge/be/dev
git pull origin staging
npm ci --production=false
npm run build
npm run migration:run
pm2 restart hb-api-staging || pm2 start dist/src/main.js --name hb-api-staging
pm2 save
```

### Production

```bash
cd /var/www/healthbridge/be/prod
git pull origin main
npm ci --production=false
npm run build
npm run migration:run
pm2 restart hb-api-prod || pm2 start dist/src/main.js --name hb-api-prod
pm2 save
```

---

## Useful Commands

```bash
# Check PM2 processes
pm2 list

# View logs
pm2 logs hb-api-staging
pm2 logs hb-api-prod

# Restart
pm2 restart hb-api-staging
pm2 restart hb-api-prod

# Check Nginx status
sudo systemctl status nginx

# Check PostgreSQL status
sudo systemctl status postgresql

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## Checklist

- [ ] EC2 instance launched with correct security group
- [ ] Node.js 24, PostgreSQL, PM2, Nginx installed
- [ ] SSH key generated on EC2 and added to GitHub as deploy key
- [ ] `~/.ssh/config` configured for `github.com`
- [ ] `ssh -T git@github.com` works
- [ ] PostgreSQL database and user created
- [ ] Repo cloned via SSH to `/var/www/healthbridge/be/prod` and `/dev`
- [ ] `.env` configured in both directories
- [ ] First build + migration successful
- [ ] PM2 running and saved with startup enabled
- [ ] Nginx reverse proxy configured
- [ ] GitHub Actions SSH key generated and added to `authorized_keys`
- [ ] GitHub secrets (`SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`) added
- [ ] CI pipeline updated to use `key` instead of `password`
- [ ] SSL certificate installed (if using a domain)
