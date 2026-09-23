#!/usr/bin/env bash
#
# ONGC Navratri — STAGING deploy script. Runs ON THE VPS, invoked over SSH
# by .github/workflows/deploy-staging.yml, AFTER the workflow has already
# rsynced the exact commit being deployed into this directory.
#
# This script does NOT fetch or check out any code itself — the workflow
# is responsible for that (see the "Sync repository to VPS" step). This
# script only installs, builds, migrates, and restarts what's already on
# disk. That split is what makes the very first deployment work too: by
# the time this script runs, the previously-empty staging directory
# already contains the full application source.
#
# What this does NOT do (by design, per the deployment brief):
#   - does not touch the production directory, PM2 processes, or Nginx site
#   - does not run `prisma migrate reset` / `db push` / drop anything
#   - does not serve the Next.js web app from the VPS (it's built here for
#     completeness/verification only; it stays on Hostinger Web App)
#   - does not roll back on its own — on failure it just exits non-zero;
#     the workflow's separate rollback step (deploy/staging-rollback.sh)
#     handles restoring the previous release. See
#     docs/STAGING_DEPLOYMENT.md "Rollback" section.

set -uo pipefail

DEPLOY_DIR="${STAGING_DEPLOY_DIR:-/var/www/ongcnavratri-staging}"
HEALTH_URL="${STAGING_HEALTH_URL:-http://127.0.0.1:3011/health}"
# TEMPORARY staging value — not a secret (a plain HTTP IP), so it's fine
# as a plain default here rather than requiring it in apps/api/.env or a
# GitHub Secret. Baked into the Next.js bundle at build time (below), not
# read at runtime. Update once the staging API has a real hostname/HTTPS.
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://100.234.41.6}"
PM2_ECOSYSTEM="ecosystem.staging.config.js"
LOG_FILE="$DEPLOY_DIR/deploy.log"
HEALTH_ATTEMPTS=10
HEALTH_DELAY_SECONDS=3

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
}

fail() {
  log "ERROR: $*"
  exit 1
}

[ -d "$DEPLOY_DIR" ] || fail "Deploy directory $DEPLOY_DIR does not exist. Create it first — see docs/STAGING_DEPLOYMENT.md."
[ -w "$DEPLOY_DIR" ] || fail "Deploy directory $DEPLOY_DIR is not writable by $(whoami). Fix ownership/permissions first — see docs/STAGING_DEPLOYMENT.md section 2.2/2.10."

cd "$DEPLOY_DIR" || fail "Could not cd into $DEPLOY_DIR."

mkdir -p "$DEPLOY_DIR/logs" || fail "Could not create $DEPLOY_DIR/logs — check permissions."
[ -w "$DEPLOY_DIR/logs" ] || fail "$DEPLOY_DIR/logs is not writable by $(whoami)."

[ -f "apps/api/.env" ] || fail "apps/api/.env is missing. Create it manually on the VPS before the first deployment — see docs/STAGING_DEPLOYMENT.md section 2.5. It is intentionally never shipped by this pipeline."

log "=== Starting staging deployment ==="

log "Installing dependencies (npm ci)..."
npm ci || fail "npm ci failed"

log "Building packages/shared-types..."
npm run build:types || fail "build:types failed"

log "Generating Prisma client..."
npm run prisma:generate || fail "prisma generate failed"

log "Applying database migrations (prisma migrate deploy — never db push, never reset)..."
# Uses the local Prisma CLI through the npm workspace script, not a global
# `prisma`/`npx prisma` — `npx prisma` failed with "prisma: not found" when
# run from the deploy directory root because the local prisma binary lives
# in apps/api's own node_modules and isn't hoisted/resolvable from there.
# `npm run ... --workspace=apps/api` runs the script with that workspace's
# node_modules/.bin on PATH, so it resolves correctly without installing
# Prisma globally.
npm run prisma:migrate:deploy --workspace=apps/api || fail "prisma migrate deploy failed"

log "Building API..."
npm run build:api || fail "build:api failed"

log "Building web (verification only — not served from this VPS) with NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL..."
npm run build:web || fail "build:web failed"

log "Starting/reloading PM2 process via $PM2_ECOSYSTEM..."
pm2 startOrReload "$PM2_ECOSYSTEM" --update-env || fail "pm2 startOrReload failed"
pm2 save || true

log "Running health check against $HEALTH_URL..."
i=1
while [ "$i" -le "$HEALTH_ATTEMPTS" ]; do
  body=$(curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null) || body=""
  if echo "$body" | grep -q '"status":"ok"'; then
    log "Health check passed on attempt $i/$HEALTH_ATTEMPTS: $body"
    log "=== Deployment SUCCESSFUL ==="
    exit 0
  fi
  log "Health check attempt $i/$HEALTH_ATTEMPTS not healthy yet (got: ${body:-<no response>}), retrying in ${HEALTH_DELAY_SECONDS}s..."
  sleep "$HEALTH_DELAY_SECONDS"
  i=$((i + 1))
done

fail "Health check never passed after $HEALTH_ATTEMPTS attempts. Deployment failed — the workflow's rollback step will restore the previous release."
