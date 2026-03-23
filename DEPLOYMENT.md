# Production Deployment Guide — Car Dealer CRM

## Architecture Overview

```
[Browser] → [Vercel — React client]
                  ↓ HTTPS API calls
         [VPS — Docker Compose]
          ├── nginx   (reverse proxy + SSL)
          ├── server  (Node.js + Express)
          └── db      (PostgreSQL 17)
                  ↓
         [Firebase — Auth + Storage]
```

---

## 1. Prerequisites

On the VPS (Ubuntu 22.04+):
- Docker + Docker Compose plugin
- A domain name pointed at the VPS IP

That's it — Node.js, PostgreSQL, PM2, and Nginx are all handled by Docker.

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # allow running docker without sudo (re-login after)
```

---

## 2. Deploy

### 2a. Clone the repo

```bash
cd /opt
sudo git clone <your-repo-url> carDealerCRM
sudo chown -R $USER:$USER /opt/carDealerCRM
cd /opt/carDealerCRM
```

### 2b. Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in all values:

```env
DB_PASSWORD=<strong random password>
CORS_ORIGIN=https://your-app.vercel.app
FIREBASE_PROJECT_ID=cars-dealer-crm
ENCRYPTION_KEY=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### 2c. Place the Firebase service account

Upload `serviceAccount.json` to the repo root and restrict permissions:

```bash
chmod 600 /opt/carDealerCRM/serviceAccount.json
```

### 2d. Start everything

```bash
docker compose up -d
```

This will:
1. Pull the PostgreSQL image
2. Build the Node.js server image
3. Run `prisma migrate deploy` automatically before the server starts
4. Start Nginx on ports 80 and 443

Check that everything is running:

```bash
docker compose ps
docker compose logs server   # watch for startup errors
```

---

## 3. SSL Certificate

The Nginx config serves HTTP on port 80 by default (required for the Certbot challenge).

### 3a. Obtain the certificate

```bash
docker run --rm \
  -v /opt/carDealerCRM/nginx/certs:/etc/letsencrypt \
  -v /opt/carDealerCRM/nginx/certbot-webroot:/var/www/certbot \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d api.your-domain.com \
  --email you@your-domain.com \
  --agree-tos --no-eff-email
```

### 3b. Enable HTTPS in Nginx

Edit `nginx/nginx.conf` — uncomment the `server { listen 443 ssl; ... }` block and replace `api.your-domain.com` with your actual domain.

```bash
docker compose restart nginx
```

### 3c. Auto-renew certificates

Add a cron job on the host:

```bash
crontab -e
```

```
0 3 1 * * docker run --rm \
  -v /opt/carDealerCRM/nginx/certs:/etc/letsencrypt \
  -v /opt/carDealerCRM/nginx/certbot-webroot:/var/www/certbot \
  certbot/certbot renew --webroot -w /var/www/certbot \
  && docker compose -f /opt/carDealerCRM/docker-compose.yml restart nginx
```

---

## 4. Client — Deploy to Vercel

### 4a. Push client code to GitHub (without `.env`)

### 4b. Connect repo to Vercel

1. Go to vercel.com → New Project → Import your repo
2. Set **Root Directory** to `car-dealer-crm-client`
3. Framework preset: **Vite**

### 4c. Add environment variables in Vercel dashboard

Under Project → Settings → Environment Variables:

```
VITE_API_URL                    = https://api.your-domain.com
VITE_FIREBASE_API_KEY           = (Firebase Console → Project Settings → Your apps)
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

---

## 5. Firebase — Production Configuration

### 5a. Firebase Auth — add production domain

Firebase Console → Authentication → Settings → Authorized domains → Add your Vercel domain.

### 5b. Firebase Storage rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 6. Backups

The server automatically runs `pg_dump` daily at 03:00 and keeps 7 days locally in `backups/`.

Trigger a manual backup anytime:
```bash
curl -X POST https://api.your-domain.com/admin/backup
```

Restore from a backup:
```bash
# Copy the dump file into the db container, then restore
docker compose cp backups/backup_YYYY-MM-DD.dump db:/tmp/backup.dump
docker compose exec db pg_restore -U crm_app -d car_dealer_crm /tmp/backup.dump
```

For off-site backups, add a host cron job after the daily backup:
```bash
# runs at 03:30, after the in-app backup at 03:00
30 3 * * * aws s3 sync /opt/carDealerCRM/backups/ s3://your-bucket/crm-backups/ \
  --endpoint-url https://s3.us-west-004.backblazeb2.com
```

---

## 7. Keeping the App Updated

```bash
cd /opt/carDealerCRM
git pull
docker compose up -d --build
```

`--build` rebuilds the server image with the latest code. Prisma migrations run automatically on startup via `entrypoint.sh`.

---

## 8. Useful Commands

```bash
docker compose ps                   # status of all containers
docker compose logs -f server       # live server logs
docker compose logs -f db           # live DB logs
docker compose restart nginx        # reload nginx (e.g. after cert renewal)
docker compose exec db psql -U crm_app -d car_dealer_crm   # open DB shell
docker compose down                 # stop everything (data is preserved in pgdata volume)
docker compose down -v              # stop + DELETE all data (destructive!)
```

---

## 9. Production Checklist

- [ ] Root `.env` filled in with production values
- [ ] `ENCRYPTION_KEY` is a freshly generated key (not the dev key)
- [ ] `serviceAccount.json` placed at repo root with `chmod 600`
- [ ] `CORS_ORIGIN` set to exact Vercel URL
- [ ] SSL certificate obtained and HTTPS block enabled in `nginx/nginx.conf`
- [ ] Certificate auto-renewal cron job configured
- [ ] Firebase Auth authorized domains updated
- [ ] Firebase Storage security rules require auth
- [ ] Off-site backup destination configured
- [ ] `.env` never committed to git
- [ ] `serviceAccount.json` never committed to git
