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
#   - does not roll back on its own — on failure it just exits non-zero;
#     the workflow's separate rollback step (deploy/staging-rollback.sh)
#     handles restoring the previous release. See
#     docs/STAGING_DEPLOYMENT.md "Rollback" section.
#
# WEB DEPLOYMENT MODEL (atomic releases):
# The API is deployed in place (rebuilt directly in $DEPLOY_DIR, same as
# always). The Next.js web app is now ALSO served from this VPS, but never
# built in place — that used to mean deleting/rewriting apps/web/.next
# directly underneath the PM2 process that was actively serving requests
# from it, which is exactly what caused the recurring "HTML references a
# _next/static chunk that doesn't exist" 400/404 bug. Instead, every
# deploy builds a brand-new, fully independent copy of the web app under
# releases-web/<release-id>/, verifies it standalone (including a local
# smoke test on a scratch port) BEFORE any traffic is switched to it, then
# atomically repoints the `current-web` symlink and only then reloads PM2.
# See docs/STAGING_DEPLOYMENT.md "Web release / atomic deployment".
#
# INDEPENDENT FAILURE SCOPING: the API and web halves below must never
# roll each other back. `fail()` records WHICH half was in progress (via
# $DEPLOY_PHASE) into $DEPLOY_FAILURE_PHASE_FILE before exiting, and
# deploy/staging-rollback.sh reads that marker to decide whether to touch
# the API's PM2 process, the web's PM2 process, or neither — never both,
# and never the one that wasn't actually affected. A fully successful
# deployment clears the marker.

set -uo pipefail

DEPLOY_DIR="${STAGING_DEPLOY_DIR:-/var/www/ongcnavratri-staging}"
HEALTH_URL="${STAGING_HEALTH_URL:-http://127.0.0.1:3011/health}"
# Not a secret, so it's fine as a plain default here rather than requiring
# it in apps/api/.env or a GitHub Secret. Baked into the Next.js bundle at
# build time (below), not read at runtime. HTTPS staging API domain (DNS/
# SSL finalized).
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api-ongcnavratri.reworkzone.in}"
PM2_ECOSYSTEM="ecosystem.staging.config.js"
LOG_FILE="$DEPLOY_DIR/deploy.log"
HEALTH_ATTEMPTS=10
HEALTH_DELAY_SECONDS=3

# --- Web atomic-release settings -------------------------------------------
# RELEASE_ID should be the Git SHA the workflow is deploying (passed in as
# an env var — this script has no .git access, since .git is deliberately
# excluded from the rsync). Falls back to a UTC timestamp so the script
# still works standalone (manual runs, local testing) without a SHA.
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)}"
WEB_RELEASES_DIR="$DEPLOY_DIR/releases-web"
NEW_WEB_RELEASE_DIR="$WEB_RELEASES_DIR/$RELEASE_ID"
CURRENT_WEB_LINK="$DEPLOY_DIR/current-web"
PREVIOUS_WEB_RELEASE_FILE="$DEPLOY_DIR/.previous-web-release"
WEB_PM2_ECOSYSTEM="ecosystem.staging-web.config.js"
WEB_HEALTH_URL="http://127.0.0.1:3012/"
WEB_SMOKE_TEST_PORT=3098
WEB_RELEASES_TO_KEEP=3

# Records which half of the deployment was in progress when a failure
# happens, so staging-rollback.sh can scope its rollback to that half only
# — an API failure must never touch current-web/ongc-web-staging, and a
# web failure must never touch the API's release/PM2 process. Starts as
# "api" since Part 1 (API) always runs first; switched to "web" right
# before Part 2 begins.
DEPLOY_PHASE="api"
DEPLOY_FAILURE_PHASE_FILE="$DEPLOY_DIR/.deploy-failure-phase"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
}

fail() {
  log "ERROR: $*"
  # Best-effort: if $DEPLOY_DIR isn't writable at all, deployment is
  # failing for a more fundamental reason anyway and rollback will find
  # no marker, which is the same safe "do nothing automatically" outcome
  # as an ambiguous phase (see staging-rollback.sh).
  printf '%s\n' "$DEPLOY_PHASE" > "$DEPLOY_FAILURE_PHASE_FILE" 2>/dev/null || true
  exit 1
}

[ -d "$DEPLOY_DIR" ] || fail "Deploy directory $DEPLOY_DIR does not exist. Create it first — see docs/STAGING_DEPLOYMENT.md."
[ -w "$DEPLOY_DIR" ] || fail "Deploy directory $DEPLOY_DIR is not writable by $(whoami). Fix ownership/permissions first — see docs/STAGING_DEPLOYMENT.md section 2.2/2.10."

cd "$DEPLOY_DIR" || fail "Could not cd into $DEPLOY_DIR."

mkdir -p "$DEPLOY_DIR/logs" || fail "Could not create $DEPLOY_DIR/logs — check permissions."
[ -w "$DEPLOY_DIR/logs" ] || fail "$DEPLOY_DIR/logs is not writable by $(whoami)."

[ -f "apps/api/.env" ] || fail "apps/api/.env is missing. Create it manually on the VPS before the first deployment — see docs/STAGING_DEPLOYMENT.md section 2.5. It is intentionally never shipped by this pipeline."

log "=== Starting staging deployment (release $RELEASE_ID) ==="

# ============================================================================
# PART 1 — API (deployed in place, unchanged from before)
# ============================================================================

log "Installing dependencies (npm ci)..."
npm ci || fail "npm ci failed"

# The repo's root .npmrc sets ignore-scripts=true (a deliberate supply-chain
# hardening default — it stops arbitrary install/postinstall scripts from
# every dependency running unreviewed). That also silently skips bcrypt's
# own "install" script (node-pre-gyp install --fallback-to-build), which is
# what fetches/builds its native Linux binary — so `npm ci` succeeds with no
# errors, but apps/api/node_modules/bcrypt/lib/binding/*/bcrypt_lib.node is
# never created, and the API crashes at runtime the first time bcrypt is
# required. Rather than turning ignore-scripts off repo-wide (which would
# re-enable install scripts for every dependency, not just this one), force
# it back on for this single, known, required package via an explicit CLI
# flag that overrides .npmrc for just this command.
log "Rebuilding bcrypt's native binary (skipped by npm ci due to ignore-scripts=true in .npmrc)..."
npm rebuild bcrypt --workspace=apps/api --ignore-scripts=false || fail "bcrypt rebuild failed"

# Preflight: fail clearly here, before building or touching PM2, if the
# native binary still isn't there — instead of discovering it only after
# PM2 starts crash-looping the process.
BCRYPT_BINDING=$(find apps/api/node_modules/bcrypt/lib/binding -type f -name 'bcrypt_lib.node' 2>/dev/null | head -1)
[ -n "$BCRYPT_BINDING" ] && [ -f "$BCRYPT_BINDING" ] || fail "bcrypt native binary not found after rebuild (expected under apps/api/node_modules/bcrypt/lib/binding/*/bcrypt_lib.node). Not starting PM2 against a broken build."
log "bcrypt native binary verified at $BCRYPT_BINDING"

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

log "Starting/reloading PM2 process via $PM2_ECOSYSTEM..."
pm2 startOrReload "$PM2_ECOSYSTEM" --update-env || fail "pm2 startOrReload failed"
pm2 save || true

log "Running API health check against $HEALTH_URL..."
i=1
api_healthy=0
while [ "$i" -le "$HEALTH_ATTEMPTS" ]; do
  body=$(curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null) || body=""
  if echo "$body" | grep -q '"status":"ok"'; then
    log "API health check passed on attempt $i/$HEALTH_ATTEMPTS: $body"
    api_healthy=1
    break
  fi
  log "API health check attempt $i/$HEALTH_ATTEMPTS not healthy yet (got: ${body:-<no response>}), retrying in ${HEALTH_DELAY_SECONDS}s..."
  sleep "$HEALTH_DELAY_SECONDS"
  i=$((i + 1))
done
[ "$api_healthy" = "1" ] || fail "API health check never passed after $HEALTH_ATTEMPTS attempts. Deployment failed — the workflow's rollback step will restore the previous release."

# ============================================================================
# PART 2 — WEB (atomic release: build → verify → symlink switch → PM2
# reload → live health check. Never rebuilds in place, never reloads PM2
# before the symlink swap.)
# ============================================================================

# From this point on, any failure belongs to the WEB half only — the API
# has already deployed and passed its own health check above, and must
# not be rolled back because of something that goes wrong here.
DEPLOY_PHASE="web"

log "=== Starting web atomic release $RELEASE_ID ==="

mkdir -p "$WEB_RELEASES_DIR" || fail "Could not create $WEB_RELEASES_DIR."

# A/B. Determine release ID (done above) and create a fresh release
# directory. If a directory for this exact release ID already exists
# (e.g. a re-run of the same commit) and it is NOT the currently-live
# release, wipe it first — it's safe, nothing is serving from it yet.
CURRENT_WEB_TARGET=""
if [ -L "$CURRENT_WEB_LINK" ]; then
  CURRENT_WEB_TARGET=$(readlink -f "$CURRENT_WEB_LINK" 2>/dev/null || true)
fi
if [ "$NEW_WEB_RELEASE_DIR" = "$CURRENT_WEB_TARGET" ]; then
  fail "releases-web/$RELEASE_ID is the currently active release — refusing to rebuild it in place. Use a different RELEASE_ID."
fi
rm -rf "$NEW_WEB_RELEASE_DIR"
mkdir -p "$NEW_WEB_RELEASE_DIR" || fail "Could not create $NEW_WEB_RELEASE_DIR."

# C. Copy the source needed to build the web app into the new release.
# This is a LOCAL copy (same VPS, not over the network) of the exact
# source the workflow just rsynced into $DEPLOY_DIR — a full npm-workspace
# root is required (not just apps/web/) because apps/web's own build
# depends on the hoisted root node_modules and the sibling
# packages/shared-types workspace (see apps/web/next.config.mjs's
# outputFileTracingRoot). apps/api's source is included too so `npm ci`
# resolves the workspace exactly like it does in $DEPLOY_DIR itself, but
# it is never built or run from within a web release directory.
log "Copying source into $NEW_WEB_RELEASE_DIR..."
rsync -a \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.next' \
  --exclude 'releases-web' \
  --exclude 'current-web' \
  --exclude 'current-web.tmp' \
  --exclude '.backup' \
  --exclude '.backup.new' \
  --exclude '.previous-web-release' \
  --exclude 'logs' \
  --exclude 'deploy.log' \
  --exclude '*.log' \
  --exclude '.git' \
  --exclude '.github' \
  --exclude 'storage' \
  "$DEPLOY_DIR"/ "$NEW_WEB_RELEASE_DIR"/ \
  || fail "Copying source into the new web release failed."

# D. Install dependencies fresh, inside the new release only.
log "Installing dependencies for the new web release (npm ci)..."
(cd "$NEW_WEB_RELEASE_DIR" && npm ci) || fail "npm ci failed inside the new web release."

log "Building packages/shared-types inside the new web release..."
(cd "$NEW_WEB_RELEASE_DIR" && npm run build:types) || fail "build:types failed inside the new web release."

# E/F. Clean build of the web app. This is the EXISTING, unmodified
# apps/web/package.json "build" script — it already runs
# `next build && node ./scripts/copy-standalone-assets.js`. Nothing about
# that script changes; only the directory it runs in is new every time.
log "Building web app inside the new release (NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL)..."
(cd "$NEW_WEB_RELEASE_DIR" && NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" npm run build --workspace=apps/web) \
  || fail "Web build failed inside the new release."

# G/H/I. Verify the standalone output actually exists before going any
# further — this is exactly the class of thing that silently broke before.
WEB_STANDALONE_DIR="$NEW_WEB_RELEASE_DIR/apps/web/.next/standalone/apps/web"
[ -f "$WEB_STANDALONE_DIR/server.js" ] || fail "Web release verification failed: $WEB_STANDALONE_DIR/server.js does not exist."
[ -d "$WEB_STANDALONE_DIR/.next/static" ] && [ -n "$(ls -A "$WEB_STANDALONE_DIR/.next/static" 2>/dev/null)" ] \
  || fail "Web release verification failed: $WEB_STANDALONE_DIR/.next/static is missing or empty."
[ -d "$WEB_STANDALONE_DIR/public" ] \
  || fail "Web release verification failed: $WEB_STANDALONE_DIR/public directory is missing."
log "Web release verified: server.js, .next/static, and public/ all present at $WEB_STANDALONE_DIR."

# J. Local smoke test of the NEW release on a scratch port, BEFORE any
# traffic is switched to it. Starts a throwaway instance of the exact same
# server.js, confirms the homepage loads AND that a _next/static/css chunk
# it actually references also loads — this directly targets the bug this
# whole mechanism exists to prevent. Always killed afterward, success or
# failure, via the trap below.
SMOKE_PID=""
cleanup_smoke_test() {
  if [ -n "$SMOKE_PID" ] && kill -0 "$SMOKE_PID" 2>/dev/null; then
    kill -15 "$SMOKE_PID" 2>/dev/null || true
    for _ in 1 2; do
      kill -0 "$SMOKE_PID" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$SMOKE_PID" 2>/dev/null; then
      kill -9 "$SMOKE_PID" 2>/dev/null || true
    fi
    wait "$SMOKE_PID" 2>/dev/null || true
  fi
}
trap cleanup_smoke_test EXIT

# 1. Pre-flight check: ensure $WEB_SMOKE_TEST_PORT is not occupied by a stale process.
CURRENT_USER=$(whoami)
stale_pids=$(ss -ltnp "sport = :$WEB_SMOKE_TEST_PORT" 2>/dev/null | grep -oE "pid=[0-9]+" | cut -d= -f2 | sort -u)
if [ -z "$stale_pids" ]; then
  stale_pids=$(fuser "${WEB_SMOKE_TEST_PORT}/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' | sort -u || true)
fi

if [ -n "$stale_pids" ]; then
  log "Detected existing listener on smoke-test port $WEB_SMOKE_TEST_PORT (PID(s): $stale_pids). Inspecting ownership..."
  for pid in $stale_pids; do
    [ -z "$pid" ] && continue
    pid_owner=$(ps -o user= -p "$pid" 2>/dev/null | tr -d '[:space:]' || true)
    pid_cmd=$(ps -o cmd= -p "$pid" 2>/dev/null || true)
    if [ "$pid_owner" = "$CURRENT_USER" ]; then
      log "Terminating stale deployment process on port $WEB_SMOKE_TEST_PORT (PID $pid: $pid_cmd)..."
      kill -15 "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    else
      fail "Port $WEB_SMOKE_TEST_PORT is occupied by PID $pid owned by '$pid_owner' (expected '$CURRENT_USER'). Refusing to kill unrelated process."
    fi
  done

  sleep 1
  remaining_pids=$(ss -ltnp "sport = :$WEB_SMOKE_TEST_PORT" 2>/dev/null | grep -oE "pid=[0-9]+" | cut -d= -f2 | sort -u)
  if [ -n "$remaining_pids" ]; then
    fail "Port $WEB_SMOKE_TEST_PORT is still occupied by PID(s): $remaining_pids after cleanup. Cannot proceed with smoke test."
  fi
  log "Port $WEB_SMOKE_TEST_PORT is verified free."
fi

# 2. Start the smoke-test Next.js server and capture its PID.
log "Starting local smoke test of the new release on port $WEB_SMOKE_TEST_PORT..."
(cd "$WEB_STANDALONE_DIR" && PORT="$WEB_SMOKE_TEST_PORT" HOSTNAME=127.0.0.1 NODE_ENV=staging exec node server.js \
  >>"$DEPLOY_DIR/logs/web-smoke-test.log" 2>&1) &
SMOKE_PID=$!
sleep 1

# 3 & 4. Immediately verify the PID is alive; if exited, print log and fail immediately without curling.
if ! kill -0 "$SMOKE_PID" 2>/dev/null; then
  log "--- Smoke test server startup log ($DEPLOY_DIR/logs/web-smoke-test.log) ---"
  tail -n 25 "$DEPLOY_DIR/logs/web-smoke-test.log" 2>/dev/null | tee -a "$LOG_FILE" || true
  fail "Smoke-test server process ($SMOKE_PID) exited immediately after startup. Check logs/web-smoke-test.log."
fi

# 5. Verify the listener on the smoke-test port belongs to SMOKE_PID.
port_bound=0
for _ in 1 2 3 4 5; do
  if ! kill -0 "$SMOKE_PID" 2>/dev/null; then
    log "--- Smoke test server startup log ($DEPLOY_DIR/logs/web-smoke-test.log) ---"
    tail -n 25 "$DEPLOY_DIR/logs/web-smoke-test.log" 2>/dev/null | tee -a "$LOG_FILE" || true
    fail "Smoke-test server process ($SMOKE_PID) died before binding to port $WEB_SMOKE_TEST_PORT."
  fi
  bound_pids=$(ss -ltnp "sport = :$WEB_SMOKE_TEST_PORT" 2>/dev/null | grep -oE "pid=[0-9]+" | cut -d= -f2 | sort -u)
  if [ -z "$bound_pids" ]; then
    bound_pids=$(fuser "${WEB_SMOKE_TEST_PORT}/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' | sort -u || true)
  fi
  if [ -n "$bound_pids" ]; then
    if echo "$bound_pids" | grep -qw "$SMOKE_PID"; then
      port_bound=1
      break
    fi
    # Also allow if the listening process is a direct child of SMOKE_PID
    for b_pid in $bound_pids; do
      b_ppid=$(ps -o ppid= -p "$b_pid" 2>/dev/null | tr -d '[:space:]' || true)
      if [ "$b_ppid" = "$SMOKE_PID" ]; then
        port_bound=1
        break 2
      fi
    done
    fail "Port $WEB_SMOKE_TEST_PORT is listening, but owned by unexpected PID(s): $bound_pids (expected smoke PID $SMOKE_PID). Refusing to smoke-test wrong process."
  fi
  sleep 1
done
[ "$port_bound" = "1" ] || fail "Smoke-test server ($SMOKE_PID) did not bind to port $WEB_SMOKE_TEST_PORT within timeout."

# 6. Existing smoke-test checks: homepage and all referenced CSS chunks.
smoke_ok=0
smoke_attempt=1
smoke_html=""
while [ "$smoke_attempt" -le 10 ]; do
  smoke_html=$(curl -fsS -m 5 "http://127.0.0.1:$WEB_SMOKE_TEST_PORT/" 2>/dev/null) && smoke_ok=1 && break
  sleep 1
  smoke_attempt=$((smoke_attempt + 1))
done
[ "$smoke_ok" = "1" ] || fail "Smoke test failed: the new web release did not respond on port $WEB_SMOKE_TEST_PORT. See logs/web-smoke-test.log."

# Extract every _next/static/css chunk the smoke-tested homepage actually
# references, and confirm each one is servable from the SAME running
# instance — the exact check that would have caught the historical bug.
CSS_CHUNKS=$(printf '%s' "$smoke_html" | grep -oE '_next/static/css/[a-zA-Z0-9]+\.css' | sort -u)
if [ -n "$CSS_CHUNKS" ]; then
  while IFS= read -r chunk; do
    [ -z "$chunk" ] && continue
    chunk_status=$(curl -o /dev/null -s -w '%{http_code}' -m 5 "http://127.0.0.1:$WEB_SMOKE_TEST_PORT/$chunk" 2>/dev/null || echo "000")
    [ "$chunk_status" = "200" ] || fail "Smoke test failed: $chunk referenced by the homepage returned HTTP $chunk_status instead of 200. Refusing to switch traffic to this release."
  done <<< "$CSS_CHUNKS"
  log "Smoke test verified $(printf '%s\n' "$CSS_CHUNKS" | wc -l) referenced CSS chunk(s) all return 200."
else
  log "Smoke test: homepage returned no _next/static/css references to verify (unexpected but not fatal)."
fi

cleanup_smoke_test
trap - EXIT
log "Smoke test passed. New release is verified end-to-end before any traffic switch."

# K. Atomically replace the current-web symlink. Record the previous
# target FIRST so a rollback can find it even after this symlink has
# already been repointed. `ln -sfn` into a temp name + `mv -T` (rename(2))
# is the atomic-swap idiom — a reader can never observe a half-updated
# symlink.
if [ -n "$CURRENT_WEB_TARGET" ]; then
  printf '%s\n' "$CURRENT_WEB_TARGET" > "$PREVIOUS_WEB_RELEASE_FILE"
  log "Recorded previous web release for rollback: $CURRENT_WEB_TARGET"
else
  log "No previous current-web target found (first web deployment) — nothing to record for rollback."
fi

log "Atomically switching current-web -> $NEW_WEB_RELEASE_DIR..."
ln -sfn "$NEW_WEB_RELEASE_DIR" "$DEPLOY_DIR/current-web.tmp" || fail "Could not create temporary symlink."
mv -Tf "$DEPLOY_DIR/current-web.tmp" "$CURRENT_WEB_LINK" || fail "Could not atomically swap current-web symlink."

# L. Only now — after the symlink swap — is PM2 touched.
log "Reloading PM2 process via $WEB_PM2_ECOSYSTEM (after symlink switch)..."
pm2 startOrReload "$WEB_PM2_ECOSYSTEM" --update-env || fail "pm2 startOrReload failed for the web process. Traffic has already switched — run deploy/staging-rollback.sh."
pm2 save || true

# M/N. Live health check against the real public port. Only after this
# passes is the deployment reported successful.
log "Running live web health check against $WEB_HEALTH_URL..."
i=1
web_healthy=0
while [ "$i" -le "$HEALTH_ATTEMPTS" ]; do
  web_status=$(curl -o /dev/null -s -w '%{http_code}' -m 5 "$WEB_HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$web_status" = "200" ]; then
    log "Web health check passed on attempt $i/$HEALTH_ATTEMPTS (HTTP $web_status)."
    web_healthy=1
    break
  fi
  log "Web health check attempt $i/$HEALTH_ATTEMPTS not healthy yet (got HTTP ${web_status:-<no response>}), retrying in ${HEALTH_DELAY_SECONDS}s..."
  sleep "$HEALTH_DELAY_SECONDS"
  i=$((i + 1))
done
[ "$web_healthy" = "1" ] || fail "Live web health check never passed after $HEALTH_ATTEMPTS attempts. Traffic has already switched to the new release — run deploy/staging-rollback.sh to restore the previous one."

# Release retention: keep the latest $WEB_RELEASES_TO_KEEP releases by
# recency, PLUS whatever current-web actually points to right now (always
# kept regardless of its rank — e.g. after a rollback repoints it to an
# older release). Never deletes the active release.
log "Cleaning up old web releases (keeping the latest $WEB_RELEASES_TO_KEEP plus the active one)..."
ACTIVE_RELEASE_PATH=$(readlink -f "$CURRENT_WEB_LINK" 2>/dev/null || true)
idx=0
while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  idx=$((idx + 1))
  if [ "$idx" -le "$WEB_RELEASES_TO_KEEP" ] || [ "$rel" = "$ACTIVE_RELEASE_PATH" ]; then
    continue
  fi
  log "Removing old web release: $rel"
  rm -rf "$rel"
done < <(ls -1dt "$WEB_RELEASES_DIR"/*/ 2>/dev/null | sed 's:/$::')

log "=== Web atomic release $RELEASE_ID SUCCESSFUL ==="

# Full success (both halves) — clear any stale failure marker so a later,
# unrelated manual rollback invocation never acts on a leftover phase from
# this run.
rm -f "$DEPLOY_FAILURE_PHASE_FILE"

log "=== Deployment SUCCESSFUL ==="
exit 0
