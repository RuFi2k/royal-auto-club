# Production Deployment Guide — Car Dealer CRM

## Architecture Overview

```
[Browser] ─┐
           │ HTTPS
[Site]  ────┼──► [External nginx reverse proxy — TLS + rate limit]
           │            │
           │            ▼
           │     [VPS — docker compose -f docker-compose.deploy.yaml]
           │      ├── client  (React 19 + Vite)
           │      ├── server  (Node.js + Express + Better Auth)
           │      ├── db      (PostgreSQL 17)
           │      └── minio   (S3-compatible object storage)
```

Auth is **Better Auth** (email/password, sessions in Postgres). File storage is
**MinIO** (S3 API). There is no Firebase and no PM2 — everything runs in
containers. Public exposure/TLS is handled by a **separate nginx proxy** (see the
sibling `../proxy` referenced by the compose file); `docker-compose.deploy.yaml`
publishes no host ports and is reached over the internal Docker network.

> The `nginx/nginx.conf` in this repo is a self-contained reference config
> (TLS termination + `limit_req` for `api.royalautoclub.org` → `server:3000`) if
> you prefer to run the proxy from here instead of `../proxy`.

---

## 1. Prerequisites

On the VPS (Ubuntu 22.04+):
- Docker + Docker Compose plugin
- Domains pointed at the VPS IP (e.g. `crm.royalautoclub.org`, `api.royalautoclub.org`)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # run docker without sudo (re-login after)
```

---

## 2. Deploy

### 2a. Clone the repo

```bash
cd /opt
sudo git clone <your-repo-url> carDealerCRM
sudo chown -R $USER:$USER /opt/carDealerCRM
cd /opt/carDealerCRM/crm
```

### 2b. Configure environment

Copy `.env.example` to `.env` next to `docker-compose.deploy.yaml` and fill it in:

```env
# Postgres
DB_PASSWORD=<strong random password>

# CORS + client
CORS_ORIGIN=https://crm.royalautoclub.org
VITE_API_URL=https://api.royalautoclub.org

# Field encryption (64 hex chars = 32 bytes)
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<generated>

# Initial admin (auto-created + auto-approved on first boot)
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<strong password>

# Better Auth
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BETTER_AUTH_SECRET=<generated>
BETTER_AUTH_URL=https://api.royalautoclub.org
BETTER_AUTH_TRUSTED_ORIGINS=https://crm.royalautoclub.org

# MinIO / S3 object storage
S3_BUCKET=crm-media
S3_ACCESS_KEY_ID=<minio root user>
S3_SECRET_ACCESS_KEY=<minio root password>
S3_PUBLIC_URL=https://api.royalautoclub.org/media/crm-media

# Read-only public API keys for the marketing site (comma-separated)
PUBLIC_API_KEYS=<random key>

# Telegram auto-poster (optional; both required or the feature is disabled)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=@royalautoclub
SITE_PUBLIC_URL=https://royalautoclub.org
```

> `S3_ENDPOINT`, `S3_REGION`, and the internal `PORT` are already set inside
> `docker-compose.deploy.yaml`; you don't put them in `.env`.

### 2c. Start everything

```bash
docker compose -f docker-compose.deploy.yaml up -d --build
```

This will:
1. Start PostgreSQL and wait until it's healthy.
2. Start MinIO and run `minio-init` to create the bucket and make it public-read.
3. Build and start the server — `entrypoint.sh` runs `prisma migrate deploy`,
   then `seedAdmin()` creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
4. Build and start the Vite client.

Check status:

```bash
docker compose -f docker-compose.deploy.yaml ps
docker compose -f docker-compose.deploy.yaml logs -f server
```

---

## 3. Reverse proxy + SSL

The public entrypoint is the external nginx proxy (`../proxy`). It must:
- terminate TLS for `crm.` (client) and `api.` (server) domains,
- proxy `api.royalautoclub.org` → `server:3000`,
- proxy `crm.royalautoclub.org` → `client:5173`,
- expose the MinIO bucket under the `S3_PUBLIC_URL` path (e.g. `/media/crm-media` → `minio:9000`).

If you instead run the bundled `nginx/nginx.conf` from this repo, obtain a cert
with Certbot (webroot challenge on port 80) and point it at
`api.royalautoclub.org`; the config already has the TLS server block and
`limit_req` wired to `server:3000`.

```bash
docker run --rm \
  -v /opt/carDealerCRM/crm/nginx/certs:/etc/letsencrypt \
  -v /opt/carDealerCRM/crm/nginx/certbot-webroot:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d api.royalautoclub.org \
  --email you@royalautoclub.org --agree-tos --no-eff-email
```

Auto-renew via a host cron job (runs monthly, reloads the proxy):

```
0 3 1 * * docker run --rm \
  -v /opt/carDealerCRM/crm/nginx/certs:/etc/letsencrypt \
  -v /opt/carDealerCRM/crm/nginx/certbot-webroot:/var/www/certbot \
  certbot/certbot renew --webroot -w /var/www/certbot && \
  docker compose -f /opt/carDealerCRM/crm/docker-compose.deploy.yaml restart
```

---

## 4. First login

1. Open the client (`https://crm.royalautoclub.org`).
2. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` — this account is auto-approved.
3. New users who register land in a **pending** state; approve them from the
   Users panel (admin only). Disabling a user revokes their active sessions.

---

## 5. Object storage (MinIO)

- Photos, tech-passport/defect scans, and zip archives are uploaded **through the
  server** (`multer` → `sharp` → `putObject`), never directly from the browser.
- The bucket is served read-only at `S3_PUBLIC_URL`; objects carry a 1-year
  immutable `Cache-Control`, so new uploads get fresh keys (no stale cache).
- The MinIO console is on port 9001 inside the network — reach it via an SSH
  tunnel or a proxy route if you need the admin UI; don't expose it publicly.

---

## 6. Backups

The server runs `pg_dump -Fc` daily at 03:00 and keeps 7 days in `backups/`.

Restore from a dump:
```bash
docker compose -f docker-compose.deploy.yaml cp \
  backups/backup_YYYY-MM-DD.dump db:/tmp/backup.dump
docker compose -f docker-compose.deploy.yaml exec db \
  pg_restore -U crm_app -d car_dealer_crm --clean /tmp/backup.dump
```

For off-site copies, add a host cron job (Postgres dumps + MinIO data):
```bash
30 3 * * * aws s3 sync /opt/carDealerCRM/crm/backups/ s3://your-bucket/crm-backups/ \
  --endpoint-url https://s3.us-west-004.backblazeb2.com
```

---

## 7. Keeping the App Updated

```bash
cd /opt/carDealerCRM/crm
git pull
docker compose -f docker-compose.deploy.yaml up -d --build
```

Prisma migrations run automatically on startup via `entrypoint.sh`.

---

## 8. Useful Commands

```bash
CF="docker compose -f docker-compose.deploy.yaml"
$CF ps                        # status of all containers
$CF logs -f server            # live server logs
$CF logs -f db                # live DB logs
$CF exec db psql -U crm_app -d car_dealer_crm   # open DB shell
$CF restart server            # restart just the API
$CF down                      # stop everything (data kept in volumes)
$CF down -v                   # stop + DELETE all data (destructive!)
```

---

## 9. Production Checklist

- [ ] `.env` filled in next to `docker-compose.deploy.yaml`
- [ ] `ENCRYPTION_KEY` and `BETTER_AUTH_SECRET` are freshly generated (not dev keys)
- [ ] `ADMIN_EMAIL` / `ADMIN_PASSWORD` set (admin auto-created on boot)
- [ ] `CORS_ORIGIN` and `BETTER_AUTH_TRUSTED_ORIGINS` set to the exact client URL
- [ ] `VITE_API_URL` and `BETTER_AUTH_URL` point at the API domain
- [ ] `S3_PUBLIC_URL` reachable and bucket served read-only
- [ ] `PUBLIC_API_KEYS` set and shared with the marketing site
- [ ] External nginx proxy terminates TLS + rate-limits `api.` and `crm.`
- [ ] Certificate auto-renewal cron job configured
- [ ] MinIO console (9001) not publicly exposed
- [ ] Off-site backup destination configured
- [ ] `.env` never committed to git
```
