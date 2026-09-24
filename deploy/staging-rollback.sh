#!/usr/bin/env bash
#
# ONGC Navratri — STAGING rollback script. Runs ON THE VPS, invoked over
# SSH by .github/workflows/deploy-staging.yml ONLY when the deploy step
# (deploy/staging-deploy.sh) failed.
#
# Rolls back the API and the web app INDEPENDENTLY, and — critically —
# ONLY THE HALF THAT ACTUALLY FAILED. deploy/staging-deploy.sh records
# which half it was in when a failure happened into
# $DEPLOY_DIR/.deploy-failure-phase ("api" or "web") right before it exits
# non-zero; this script reads that marker and calls exactly one of
# rollback_api()/rollback_web() — never both, and never the one that
# wasn't affected. This matters because a failure while deploying the web
# app happens strictly AFTER the API has already deployed successfully and
# passed its own health check — rolling the API back in that case would
# discard a perfectly good, already-verified API release for no reason,
# and vice versa. If the marker is missing or unrecognized (e.g. a manual
# invocation with no preceding failed deploy from this script), this
# script does NOT guess — it does nothing automatically and reports that,
# since doing the wrong side is worse than doing nothing.
#
# ============================================================================
# API rollback (unchanged behavior from before the web atomic-release work):
# ============================================================================
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
# everything in the deploy directory EXCEPT .backup and the web
# atomic-release state (releases-web/, current-web, .previous-web-release
# — none of that is part of the API's in-place release and must survive
# an API-only rollback untouched), then move .backup's contents back up
# to the top level.
#
# Limitation: this restores CODE and the running process only. If the
# failed deploy already applied a new Prisma migration before a later
# step failed, that schema change is NOT automatically reverted. Check
# deploy.log in the staging directory to see whether a migration ran
# before assuming the database matches the rolled-back code. See
# docs/STAGING_DEPLOYMENT.md "Rollback" section.
#
# ============================================================================
# Web rollback (new — atomic releases):
# ============================================================================
# Never rebuilds. Repoints the current-web symlink back to the previous
# release directory (recorded by staging-deploy.sh in
# .previous-web-release right before it switched the symlink; falls back to
# the second-most-recent releases-web/ directory by modification time if
# that file is missing), reloads PM2, and health-checks port 3012.

set -uo pipefail

DEPLOY_DIR="${STAGING_DEPLOY_DIR:-/var/www/ongcnavratri-staging}"
HEALTH_URL="${STAGING_HEALTH_URL:-http://127.0.0.1:3011/health}"
API_PM2_ECOSYSTEM="ecosystem.staging.config.js"
LOG_FILE="$DEPLOY_DIR/deploy.log"
HEALTH_ATTEMPTS=10
HEALTH_DELAY_SECONDS=3

BACKUP_DIR="${DEPLOY_DIR}/.backup"
DEPLOY_FAILURE_PHASE_FILE="$DEPLOY_DIR/.deploy-failure-phase"

WEB_RELEASES_DIR="$DEPLOY_DIR/releases-web"
CURRENT_WEB_LINK="$DEPLOY_DIR/current-web"
PREVIOUS_WEB_RELEASE_FILE="$DEPLOY_DIR/.previous-web-release"
WEB_PM2_ECOSYSTEM="ecosystem.staging-web.config.js"
WEB_HEALTH_URL="http://127.0.0.1:3012/"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE" 2>/dev/null || echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

# ============================================================================
# API rollback — logic unchanged from before; only wrapped in a function so
# it no longer unconditionally exits the whole script (the web rollback
# below must still run regardless of whether the API had a backup to
# restore).
# ============================================================================
rollback_api() {
  # A usable backup must actually contain a previous release, not just
  # exist as an empty/incomplete directory — checking for the PM2 ecosystem
  # file specifically confirms there's a real deployable release in there,
  # not just a directory. Without this check, a first deployment (which has
  # no previous release at all) could fall through to the pm2 call below
  # with nothing valid to start, producing a confusing
  # "[PM2][ERROR] File ecosystem.staging.config.js not found" instead of a
  # clear "nothing to roll back to" message.
  if [ ! -d "$BACKUP_DIR" ] || [ ! -f "$BACKUP_DIR/$API_PM2_ECOSYSTEM" ]; then
    log "[API] No usable backup at $BACKUP_DIR (missing or incomplete) — likely the first deployment, which has no previous release to restore. Leaving the deploy directory as-is and skipping PM2; nothing to roll back to."
    return 1
  fi

  log "[API] === Rolling back: restoring $BACKUP_DIR into $DEPLOY_DIR ==="

  # Remove everything in the deploy directory except the backup itself AND
  # the web atomic-release state — a web release/rollback is completely
  # independent of the API's in-place release and must never be touched by
  # restoring the API's backup.
  local fail_restore=0
  find "$DEPLOY_DIR" -mindepth 1 -maxdepth 1 \
    ! -name '.backup' \
    ! -name 'releases-web' \
    ! -name 'current-web' \
    ! -name '.previous-web-release' \
    -exec rm -rf {} + \
    || fail_restore=1

  # Move the backup's contents up to the top level, then drop the now-empty
  # .backup marker.
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -exec mv {} "$DEPLOY_DIR"/ \; \
    || fail_restore=1
  rmdir "$BACKUP_DIR" 2>/dev/null || rm -rf "$BACKUP_DIR"

  if [ "$fail_restore" = "1" ]; then
    log "[API] CRITICAL: restore steps reported an error moving files. Manual intervention required now."
    return 1
  fi

  cd "$DEPLOY_DIR" || { log "[API] CRITICAL: $DEPLOY_DIR missing after restore. Manual intervention required now."; return 1; }

  # Re-verify after the move: only call pm2 if the restored release actually
  # has its ecosystem file at the top level. Should always be true given the
  # check above, but this is the guard that actually protects the pm2 call.
  if [ ! -f "$API_PM2_ECOSYSTEM" ]; then
    log "[API] CRITICAL: restore completed but $API_PM2_ECOSYSTEM is missing from $DEPLOY_DIR after restore. Not calling pm2. Manual intervention required now."
    return 1
  fi

  log "[API] Reloading PM2 with restored release..."
  pm2 startOrReload "$API_PM2_ECOSYSTEM" --update-env || log "[API] WARNING: pm2 startOrReload reported an error during rollback — check pm2 status manually."
  pm2 save || true

  log "[API] Running health check against $HEALTH_URL..."
  local i=1
  while [ "$i" -le "$HEALTH_ATTEMPTS" ]; do
    local body
    body=$(curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null) || body=""
    if echo "$body" | grep -q '"status":"ok"'; then
      log "[API] Rollback successful: previous release is running and healthy again."
      return 0
    fi
    log "[API] Health check attempt $i/$HEALTH_ATTEMPTS not healthy yet (got: ${body:-<no response>}), retrying in ${HEALTH_DELAY_SECONDS}s..."
    sleep "$HEALTH_DELAY_SECONDS"
    i=$((i + 1))
  done

  log "[API] CRITICAL: rollback restore completed but health check still fails. Manual intervention required now."
  return 1
}

# ============================================================================
# Web rollback — atomic releases. Never rebuilds: just repoints the
# current-web symlink back to the previous release and reloads PM2.
# ============================================================================
rollback_web() {
  local previous_release=""

  if [ -f "$PREVIOUS_WEB_RELEASE_FILE" ]; then
    previous_release=$(cat "$PREVIOUS_WEB_RELEASE_FILE" 2>/dev/null || true)
  fi

  # Fallback if the marker file is missing/stale: pick the second-most-recent
  # releases-web/ directory by modification time that isn't the current
  # (broken) target.
  if [ -z "$previous_release" ] || [ ! -d "$previous_release" ]; then
    local current_target=""
    if [ -L "$CURRENT_WEB_LINK" ]; then
      current_target=$(readlink -f "$CURRENT_WEB_LINK" 2>/dev/null || true)
    fi
    previous_release=""
    while IFS= read -r rel; do
      [ -z "$rel" ] && continue
      if [ "$rel" != "$current_target" ]; then
        previous_release="$rel"
        break
      fi
    done < <(ls -1dt "$WEB_RELEASES_DIR"/*/ 2>/dev/null | sed 's:/$::')
  fi

  if [ -z "$previous_release" ] || [ ! -d "$previous_release" ]; then
    log "[WEB] No usable previous web release found under $WEB_RELEASES_DIR — nothing to roll back to. Leaving current-web as-is."
    return 1
  fi

  local standalone_check="$previous_release/apps/web/.next/standalone/apps/web/server.js"
  if [ ! -f "$standalone_check" ]; then
    log "[WEB] CRITICAL: candidate previous release $previous_release does not contain a valid standalone build ($standalone_check missing). Refusing to roll back to it."
    return 1
  fi

  log "[WEB] === Rolling back: repointing current-web -> $previous_release ==="

  ln -sfn "$previous_release" "$DEPLOY_DIR/current-web.tmp" || { log "[WEB] CRITICAL: could not create temporary symlink."; return 1; }
  mv -Tf "$DEPLOY_DIR/current-web.tmp" "$CURRENT_WEB_LINK" || { log "[WEB] CRITICAL: could not atomically swap current-web symlink."; return 1; }

  log "[WEB] Reloading PM2 with restored release..."
  pm2 startOrReload "$WEB_PM2_ECOSYSTEM" --update-env || log "[WEB] WARNING: pm2 startOrReload reported an error during rollback — check pm2 status manually."
  pm2 save || true

  log "[WEB] Running health check against $WEB_HEALTH_URL..."
  local i=1
  while [ "$i" -le "$HEALTH_ATTEMPTS" ]; do
    local status
    status=$(curl -o /dev/null -s -w '%{http_code}' -m 5 "$WEB_HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$status" = "200" ]; then
      log "[WEB] Rollback successful: previous release ($previous_release) is running and healthy again."
      return 0
    fi
    log "[WEB] Health check attempt $i/$HEALTH_ATTEMPTS not healthy yet (got HTTP ${status:-<no response>}), retrying in ${HEALTH_DELAY_SECONDS}s..."
    sleep "$HEALTH_DELAY_SECONDS"
    i=$((i + 1))
  done

  log "[WEB] CRITICAL: rollback repoint completed but health check still fails. Manual intervention required now."
  return 1
}

# Determine which half actually failed. This is the sole gate that decides
# whether rollback_api or rollback_web runs — never both, and never a
# guess when it's ambiguous.
FAILED_PHASE=""
if [ -f "$DEPLOY_FAILURE_PHASE_FILE" ]; then
  FAILED_PHASE=$(cat "$DEPLOY_FAILURE_PHASE_FILE" 2>/dev/null | tr -d '[:space:]')
fi

case "$FAILED_PHASE" in
  api)
    log "Failure phase marker says: API. Rolling back the API only — current-web and ongc-web-staging will NOT be touched."
    api_result=0
    rollback_api || api_result=1
    rm -f "$DEPLOY_FAILURE_PHASE_FILE"
    if [ "$api_result" = "0" ]; then
      log "=== Rollback SUCCESSFUL (API restored; web left untouched) ==="
      exit 0
    fi
    log "=== API rollback FAILED. See log lines above. Web was not touched. ==="
    exit 1
    ;;
  web)
    log "Failure phase marker says: WEB. Rolling back the web release only — the API and ongc-api-staging will NOT be touched."
    web_result=0
    rollback_web || web_result=1
    rm -f "$DEPLOY_FAILURE_PHASE_FILE"
    if [ "$web_result" = "0" ]; then
      log "=== Rollback SUCCESSFUL (web release restored; API left untouched) ==="
      exit 0
    fi
    log "=== Web rollback FAILED. See log lines above. API was not touched. ==="
    exit 1
    ;;
  *)
    log "No usable failure-phase marker found at $DEPLOY_FAILURE_PHASE_FILE (missing, empty, or unrecognized: '${FAILED_PHASE}')."
    log "Refusing to guess which side failed — rolling back the wrong side would discard a working release for no reason. Neither the API nor the web release was touched."
    log "Investigate deploy.log manually, then either re-run the deploy or roll back the appropriate side by hand (see docs/STAGING_DEPLOYMENT.md sections 7 and 7a)."
    exit 1
    ;;
esac
