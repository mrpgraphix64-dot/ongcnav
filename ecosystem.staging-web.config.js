// PM2 process definition for the STAGING Next.js frontend.
//
// ATOMIC RELEASE MODEL (see deploy/staging-deploy.sh and
// docs/STAGING_DEPLOYMENT.md "Web release / atomic deployment" section):
// each deploy builds a completely fresh, independent copy of the web app
// under releases-web/<release-id>/ and only ever touches the live process
// by atomically repointing the `current-web` symlink and then reloading
// PM2 — never by rebuilding in place underneath the running process. This
// eliminates the recurring "HTML references a _next/static chunk that
// doesn't exist" 400/404 bug, which was caused by rebuilding directly
// inside the directory PM2 was actively serving from.
//
// `cwd` is resolved via `__dirname` (this file's own directory, i.e.
// $DEPLOY_DIR — always an absolute path) rather than a bare relative
// string, specifically so it does not depend on which directory `pm2` is
// invoked from. PM2's own relative-path resolution for `cwd` varies by
// how/where the ecosystem file is loaded from, so resolving it ourselves
// with an absolute path removes that ambiguity entirely.
//
// Deliberately separate from ecosystem.staging.config.js (the staging API
// process, unaffected by this file) and from production ecosystem.config.js:
// - Different process name (`ongc-web-staging`) so `pm2` commands can
//   never accidentally target the wrong environment.
// - Bound to 127.0.0.1 only — not directly internet-facing. Public access
//   goes through nginx/staging-web.conf, proxying port 80 to this process.
// - Fork mode / single instance — staging doesn't need production's
//   throughput.
//
// No secrets here — NEXT_PUBLIC_API_URL is baked in at BUILD time (see
// docs/STAGING_DEPLOYMENT.md), not read from this file at runtime.
const path = require('path');

// __dirname is $DEPLOY_DIR (this file lives at the staging deploy
// directory's root), so this always resolves to
// <DEPLOY_DIR>/current-web/apps/web/.next/standalone/apps/web regardless
// of the working directory `pm2` happens to be invoked from.
const webCwd = path.join(
  __dirname,
  'current-web',
  'apps',
  'web',
  '.next',
  'standalone',
  'apps',
  'web',
);

module.exports = {
  apps: [
    {
      name: 'ongc-web-staging',
      cwd: webCwd,
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '15s',
      restart_delay: 2000,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'staging',
        PORT: 3012,
        HOSTNAME: '127.0.0.1',
      },
      time: true,
    },
  ],
};
