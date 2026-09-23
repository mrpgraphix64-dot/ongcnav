#!/usr/bin/env bash
#
# ONGC Navratri — STAGING rollback script. Runs ON THE VPS, invoked over
# SSH by .github/workflows/deploy-staging.yml ONLY when the deploy step
# (deploy/staging-deploy.sh) failed.
#
# Restores the previous release from the backup that the workflow's
# "Back up current release on VPS" step took (a full copy including
# node_modules/dist, so this does NOT need to reinstall or rebuild —
# just swap the files back and reload PM2). This is why the backup
# step runs before every rsync: this script has nothing to do if that
# backup doesn't exist, which only happens on a failed first deployment
# (nothing to roll back to yet).
#
# The backup lives INSIDE the deploy directory, at .backup — not as a
# sibling directory — because the deploy user (ongcdeploy) owns the
# deploy directory but not its parent (/var/www), and this pipeline never
# uses sudo. That means restoring can't just `rm -rf` the deploy
# directory and `mv` the backup over it (that would delete the backup
# along with everything else, since it's nested inside). Instead: wipe
# everything in the deploy directory EXCEPT .backup, then move .backup's
# contents back up to the top level.
#
# Limitation: this restores CODE and the running process only. If the
# failed deploy already applied a new Prisma migration before a later
# step failed, that schema change is NOT automatically reverted. Check
# deploy.log in the staging directory to see whether a migration ran
# before assuming the database matches the rolled-back code. See
# docs/STAGING_DEPLOYMENT.md "Rollback" section.

set -uo pipefail

DEPLOY_DIR="${STAGING_DEPLOY_DIR:-/var/www/ongcnavratri-staging}"
BACKUP_DIR="${DEPLOY_DIR}/.backup"
HEALTH_URL="${STAGING_HEALTH_URL:-http://127.0.0.1:3011/health}"
PM2_ECOSYSTEM="ecosystem.staging.config.js"
LOG_FILE="$DEPLOY_DIR/deploy.log"
HEALTH_ATTEMPTS=10
HEALTH_DELAY_SECONDS=3

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE" 2>/dev/null || echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

if [ ! -d "$BACKUP_DIR" ]; then
  log "CRITICAL: no backup found at $BACKUP_DIR — nothing to roll back to (likely a failed first deployment). Manual intervention required now."
  exit 1
fi

log "=== Rolling back: restoring $BACKUP_DIR into $DEPLOY_DIR ==="

# Remove everything in the deploy directory except the backup itself.
find "$DEPLOY_DIR" -mindepth 1 -maxdepth 1 ! -name '.backup' -exec rm -rf {} + \
  || fail_restore=1

# Move the backup's contents up to the top level, then drop the now-empty
# .backup marker.
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -exec mv {} "$DEPLOY_DIR"/ \; \
  || fail_restore=1
rmdir "$BACKUP_DIR" 2>/dev/null || rm -rf "$BACKUP_DIR"

if [ "${fail_restore:-0}" = "1" ]; then
  log "CRITICAL: restore steps reported an error moving files. Manual intervention required now."
  exit 1
fi

cd "$DEPLOY_DIR" || { log "CRITICAL: $DEPLOY_DIR missing after restore. Manual intervention required now."; exit 1; }

log "Reloading PM2 with restored release..."
pm2 startOrReload "$PM2_ECOSYSTEM" --update-env || log "WARNING: pm2 startOrReload reported an error during rollback — check pm2 status manually."
pm2 save || true

log "Running health check against $HEALTH_URL..."
i=1
while [ "$i" -le "$HEALTH_ATTEMPTS" ]; do
  body=$(curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null) || body=""
  if echo "$body" | grep -q '"status":"ok"'; then
    log "Rollback successful: previous release is running and healthy again."
    exit 0
  fi
  log "Health check attempt $i/$HEALTH_ATTEMPTS not healthy yet (got: ${body:-<no response>}), retrying in ${HEALTH_DELAY_SECONDS}s..."
  sleep "$HEALTH_DELAY_SECONDS"
  i=$((i + 1))
done

log "CRITICAL: rollback restore completed but health check still fails. Manual intervention required now."
exit 1
