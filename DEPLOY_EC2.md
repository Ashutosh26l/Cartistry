# EC2 Branch-Based Deployment (Simple Company-Style Flow)

## 1) Branch Strategy

- `main`: active development integration branch
- `prod-ec2`: production deployment branch (auto deploys to EC2)

Recommended flow:
1. Create feature branch from `main`
2. Raise PR into `main`
3. After merge to `main`, raise PR from `main` to `prod-ec2`
4. Merge PR to `prod-ec2` only when ready to deploy
5. GitHub Action deploys automatically to EC2 public IP/domain

## 2) EC2 One-Time Setup

Use Ubuntu EC2. Open inbound ports in security group:
- `22` (SSH, your IP only)
- `80` (public HTTP)

Run on EC2:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
mkdir -p /var/www/ecommerce
```

## 3) GitHub Secrets Required

In repository settings -> Secrets and variables -> Actions, add:

- `EC2_HOST`: public IP or domain of EC2
- `EC2_PORT`: `22` (or custom SSH port)
- `EC2_USER`: `ubuntu` (or your Linux username)
- `EC2_SSH_PRIVATE_KEY`: private key content (`.pem` content)
- `EC2_ENV_FILE`: full production env file content

Example value for `EC2_ENV_FILE`:

```env
PORT=5500
NODE_ENV=production
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=use_min_32_chars_random
SESSION_SECRET=use_min_32_chars_random
COOKIE_SECRET=use_min_32_chars_random
CORS_ORIGIN=http://YOUR_EC2_PUBLIC_IP
```

## 4) Workflow Files Added

- `.github/workflows/ci.yml`: PR checks
- `.github/workflows/deploy-ec2.yml`: deploy on push to `prod-ec2`

## 5) Deployment Files Added

- `server/Dockerfile`
- `server/.dockerignore`
- `deploy/docker-compose.prod.yml`
- `deploy/deploy.sh`

## 6) Deploy

1. Push these files to GitHub.
2. Create `prod-ec2` branch:

```bash
git checkout -b prod-ec2
git push -u origin prod-ec2
```

3. Merge `main` -> `prod-ec2` when you want production release.
4. Open Actions tab and confirm `Deploy To EC2` passed.
5. Visit `http://EC2_PUBLIC_IP`.

Any new commit merged to `prod-ec2` will automatically reflect at the same URL.
