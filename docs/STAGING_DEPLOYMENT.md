# Staging Deployment Guide

Automated staging deployment for the NestJS API (`apps/api`) to a Hostinger
Ubuntu 24.04 VPS, driven by GitHub Actions. This is **separate from and
does not touch** the existing production deployment documented in
[`PRODUCTION_DEPLOYMENT.md`](./PRODUCTION_DEPLOYMENT.md).

The Next.js web app (`apps/web`) stays on Hostinger Web App and is **not**
deployed by this pipeline. If a decision is later made to host it on the
VPS too, this doc will need a PM2 + Nginx entry for it, mirroring the API's.

## 1. What this pipeline does

On every push to `main` (or manual trigger):

1. **`build-and-verify` job** (GitHub-hosted runner): `npm ci`, build
   shared-types, build API, build web, run API tests. If any step fails,
   nothing is deployed.
2. **`deploy` job** (GitHub-hosted runner + SSH/rsync to the VPS):
   - checks out the exact commit that triggered the workflow,
   - backs up the current live release on the VPS (a full local copy on
     the VPS, including its already-built `node_modules`/`dist`, so a
     rollback doesn't need to rebuild — no-op on the very first deploy),
   - `rsync`s that commit's source straight into the staging directory,
     excluding `node_modules`, `dist`, `.next`, `.env*`, `.git`, `.github`,
     `coverage`, and logs — nothing built or secret ever crosses the wire,
   - SSHes in and runs
     [`deploy/staging-deploy.sh`](../deploy/staging-deploy.sh), which:
     - `npm ci`,
     - builds shared-types,
     - `prisma generate`,
     - `prisma migrate deploy` (never `db push`, never `reset`),
     - builds the API,
     - builds the web app (verification only — still not served from the VPS),
     - `pm2 startOrReload ecosystem.staging.config.js`,
     - polls `GET /health` until it reports healthy, exiting non-zero if it
       never does,
   - if the deploy step fails, runs
     [`deploy/staging-rollback.sh`](../deploy/staging-rollback.sh), which
     restores the pre-deploy backup and reloads PM2 (see
     [Rollback](#7-rollback) below).

The workflow — not the VPS — is what decides which commit gets deployed.
`deploy/staging-deploy.sh` no longer does any git operations; it assumes
the correct source is already in place, which is what makes the first
deployment (empty staging directory) work the same way as every
subsequent one.

## 2. One-time VPS setup (manual — you must do this)

Run as a user with sudo access. Do **not** run any of this against the
existing production directory or the existing Laravel site.

### 2.1 System packages

```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx postgresql redis-server
sudo npm install -g pm2
```

Confirm versions:

```bash
node -v   # expect v22.x
psql --version
redis-server --version
nginx -v
pm2 -v
```

### 2.2 Deploy directory

```bash
sudo mkdir -p /var/www/ongcnavratri-staging
sudo chown "$USER":"$USER" /var/www/ongcnavratri-staging
```

That's it — leave it empty. The GitHub Actions workflow populates it via
`rsync` on the first run; there's no need to `git clone` manually. (Git
itself isn't even required on the VPS for this pipeline — only `node`,
`npm`, `pm2`, `curl`, and `rsync`'s server-side counterpart, which ships
with OpenSSH.)

If `/var/www/ongcnavratri-staging` isn't the right path on your actual VPS
(e.g. disk layout differs), pick an equivalent directory that is clearly
separate from `/var/www/ongc-rebuild` (production) — and update
`STAGING_DEPLOY_DIR` in `.github/workflows/deploy-staging.yml` and in the
`ecosystem.staging.config.js` / script defaults accordingly.

### 2.3 PostgreSQL staging database

Create a **new, staging-only** DB and user — do not reuse production
credentials:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER ongc_staging WITH PASSWORD 'CHANGE_ME_TO_A_STRONG_RANDOM_PASSWORD';
CREATE DATABASE ongc_navratri_staging OWNER ongc_staging;
GRANT ALL PRIVILEGES ON DATABASE ongc_navratri_staging TO ongc_staging;
SQL
```

Resulting `DATABASE_URL`:

```
postgresql://ongc_staging:CHANGE_ME_TO_A_STRONG_RANDOM_PASSWORD@127.0.0.1:5432/ongc_navratri_staging
```

### 2.4 Redis

Default local Redis install is fine for staging. Confirm it's running:

```bash
sudo systemctl enable --now redis-server
redis-cli ping   # expect PONG
```

Resulting `REDIS_URL` (no auth by default):

```
redis://127.0.0.1:6379
```

> **Finding worth knowing:** `.env.example` in this repo lists
> `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`, but
> `apps/api/src/redis/redis.service.ts` only ever reads `REDIS_URL`. Those
> other three vars are dead — don't rely on them. If Redis is unreachable,
> the app degrades gracefully to in-memory mode rather than crashing, but
> for a real staging environment you should still have Redis actually
> running.

### 2.5 Create `apps/api/.env` on the VPS (never committed to git)

```bash
cd /var/www/ongcnavratri-staging/apps/api
cat > .env <<'ENV'
NODE_ENV=staging
PORT=3011
DATABASE_URL=postgresql://ongc_staging:CHANGE_ME_TO_A_STRONG_RANDOM_PASSWORD@127.0.0.1:5432/ongc_navratri_staging
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=1d
CORS_ORIGINS=https://staging-web.YOUR-DOMAIN.example
APP_URL=https://staging-api.YOUR-DOMAIN.example
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=CHANGE_ME_TO_A_STRONG_PASSWORD
APP_TIMEZONE=Asia/Kolkata
LOAD_TESTING_ENABLED=false
DEMO_ADMIN_BYPASS=false
ENV
chmod 600 .env
```

Replace every placeholder value before starting the app. This file is
created **once, manually**, and is not written to by CI — the deploy
script only reads it (via NestJS's `ConfigModule`) at process start.

### 2.6 PM2 startup persistence

The first GitHub Actions run (section 3 secrets must be set first) does
the initial `npm ci` / build / `prisma migrate deploy` / `pm2 startOrReload`
/ `pm2 save` for you — see [What this pipeline does](#1-what-this-pipeline-does).
After that first successful deployment, enable PM2 on boot once:

```bash
pm2 startup   # follow the printed command to enable PM2 on boot
```

If you'd rather do the very first deploy manually instead of via GitHub
Actions (e.g. to sanity-check the VPS setup before wiring up CI), you can
manually place the source in `/var/www/ongcnavratri-staging` yourself
(e.g. `git clone` it there temporarily) and run the same steps that
[`deploy/staging-deploy.sh`](../deploy/staging-deploy.sh) runs, then let
subsequent deployments go through the workflow as normal.

### 2.7 Nginx + HTTPS

```bash
sudo cp nginx/staging-api.conf /etc/nginx/sites-available/ongcnavratri-staging
# Edit the file: replace staging-api.YOUR-DOMAIN.example with the real
# staging API hostname once you have one.
sudo nano /etc/nginx/sites-available/ongcnavratri-staging
sudo ln -s /etc/nginx/sites-available/ongcnavratri-staging /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d staging-api.YOUR-DOMAIN.example
```

Certbot rewrites the file in place to add the HTTPS server block and the
HTTP→HTTPS redirect. Don't hand-write the SSL block before the cert
exists — `nginx -t` will fail on a missing cert path.

This is entirely separate from the production `nginx.conf` /
`ongc-laravel.conf` sites already on the box — do not edit those.

### 2.8 SSH key for GitHub Actions

Generate a dedicated deploy key (don't reuse a personal key):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ongc_staging_deploy -N ""
cat ~/.ssh/ongc_staging_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/ongc_staging_deploy   # copy this private key into the VPS_SSH_KEY GitHub secret
```

## 3. GitHub Secrets required

Set these under the repo's **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `VPS_HOST` | Staging VPS IP or hostname |
| `VPS_USER` | SSH user (e.g. the one created in 2.2/2.8) |
| `VPS_SSH_KEY` | Private half of the deploy key from 2.8 |
| `VPS_PORT` | SSH port (usually `22`) |
| `STAGING_HEALTH_URL` | *(optional)* Public health URL, e.g. `https://staging-api.YOUR-DOMAIN.example/health` — enables the workflow's external health check step |

Application secrets (`DATABASE_URL`, `JWT_SECRET`, etc.) are **not**
GitHub Secrets and are **not** touched by CI. They live only in
`apps/api/.env` on the VPS (section 2.5), created once manually. This
keeps the blast radius of a leaked GitHub secret limited to SSH access,
not full application secrets.

## 4. Environment variables reference

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string, staging DB only |
| `REDIS_URL` | yes (recommended) | App degrades to in-memory if unset/unreachable |
| `JWT_SECRET` | yes | Long random string, staging-only value |
| `JWT_EXPIRES_IN` | yes | e.g. `1d` |
| `CORS_ORIGINS` | yes | Staging frontend origin(s), comma-separated if multiple |
| `APP_URL` | yes | Public staging API URL |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | yes | Seed/admin bootstrap credentials, staging-only |
| `NODE_ENV` | yes | `staging` |
| `APP_TIMEZONE` | yes | e.g. `Asia/Kolkata` |
| `LOAD_TESTING_ENABLED` | as needed | `false` unless actively load testing |
| `DEMO_ADMIN_BYPASS` | as needed | `false` for a realistic staging environment |
| `PORT` | yes | `3011` (matches `ecosystem.staging.config.js` and Nginx upstream) |

## 5. Health check

`GET /health` (added in [`apps/api/src/health/`](../apps/api/src/health/))
checks:
- **Database (Prisma, `SELECT 1`)** — hard dependency; returns HTTP 503 if
  down.
- **Redis (`ping()`)** — best-effort, matching the app's existing
  in-memory-fallback design; a Redis outage is reported in the response
  but does not fail the check.

Used by both `deploy/staging-deploy.sh` (local, `127.0.0.1:3011/health`)
and, optionally, the GitHub Actions workflow (public URL via
`STAGING_HEALTH_URL`).

## 6. Known pre-existing issue: compiled entry point path

A clean build of `apps/api` produces `dist/apps/api/src/main.js`, **not**
`dist/main.js` as `apps/api/package.json`'s `start:prod` script and the
existing **production** `ecosystem.config.js` both assume. Root cause:
`apps/api/tsconfig.json`'s `paths` mapping for `@ongc/shared-types` lists
the raw `.ts` source before the compiled `.d.ts`, which pulls the
monorepo-external source file into the compilation and expands
TypeScript's auto-computed `rootDir`.

This was **not introduced by this deployment work** — it's pre-existing
and very likely affects production the same way. It was worked around
here, not fixed, to honor "do not rewrite the application": staging's
`ecosystem.staging.config.js` points `script` directly at the real path
(`dist/apps/api/src/main.js`). Recommend fixing `start:prod` and the
production ecosystem config to match once someone with authority over
the application code can confirm the safe way to do so (either correcting
the `tsconfig.json` `paths` order with the `rootDir` implications handled
properly, or simply pointing both configs at the real output path as done
here).

## 7. Rollback

Before every `rsync`, the workflow makes a full local copy of the current
live release on the VPS at `/var/www/ongcnavratri-staging.backup`
(including its already-built `node_modules`/`dist` — no-op on the first
deployment, since there's nothing yet to back up). If
`deploy/staging-deploy.sh` fails for any reason — a build error, a failed
migration, or the health check never passing — the workflow's "Roll back
to previous release on failure" step runs
[`deploy/staging-rollback.sh`](../deploy/staging-rollback.sh) on the VPS,
which deletes the broken directory, moves the backup back into place, and
reloads PM2 against it. Because the backup already has its dependencies
installed and its build output in place, rollback doesn't need to
reinstall or rebuild anything, which keeps it reliable even if the
failure was caused by a broken dependency install.

**Limitation:** rollback restores **code, `node_modules`, and the PM2
process** only — it does not revert Prisma migrations. If a failed deploy
already applied a new migration before a later step failed, the database
schema stays on the new migration even though the code rolls back. Check
`deploy.log` in the staging directory after any rollback to see exactly
which step failed and whether a migration ran before assuming the
database matches the rolled-back code.

Manual rollback (if needed outside the automated path):

```bash
cd /var/www
[ -d ongcnavratri-staging.backup ] || echo "No backup available — nothing to restore"
rm -rf ongcnavratri-staging
mv ongcnavratri-staging.backup ongcnavratri-staging
cd ongcnavratri-staging
pm2 startOrReload ecosystem.staging.config.js --update-env
```

## 8. Manual VPS checklist (summary)

- [ ] Node 22, PostgreSQL, Redis, Nginx, PM2, Git installed
- [ ] `/var/www/ongcnavratri-staging` created, owned by the deploy user, left empty (the workflow populates it)
- [ ] Staging Postgres DB + user created (section 2.3)
- [ ] Redis running (section 2.4)
- [ ] `apps/api/.env` created with real staging secrets (section 2.5)
- [ ] Initial build + `pm2 start` + `pm2 save` + `pm2 startup` done (section 2.6)
- [ ] Nginx site configured with real hostname + certbot HTTPS (section 2.7)
- [ ] Dedicated SSH deploy key generated and authorized (section 2.8)

## 9. GitHub Secrets checklist (summary)

- [ ] `VPS_HOST`
- [ ] `VPS_USER`
- [ ] `VPS_SSH_KEY`
- [ ] `VPS_PORT`
- [ ] `STAGING_HEALTH_URL` (optional)

## 10. Do not push/deploy until reviewed

Per the deployment brief, none of this has been pushed or run against the
real VPS. Review this document and the files under `deploy/`,
`.github/workflows/deploy-staging.yml`, `ecosystem.staging.config.js`, and
`nginx/staging-api.conf` before merging/pushing to `main` (which will
trigger the workflow) or manually running `workflow_dispatch`.
