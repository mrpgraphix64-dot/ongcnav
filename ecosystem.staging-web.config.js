// PM2 process definition for the STAGING Next.js frontend.
//
// Permanent staging web deployment on the VPS, serving the frontend from
// ongcnavratri.reworkzone.in (see nginx/staging-web.conf) — the temporary
// HTTP-only smoke-test setup (ecosystem.staging-web-temp.config.js,
// nginx/staging-web-temp.conf, port 8080) has been abandoned and removed.
//
// Deliberately separate from ecosystem.staging.config.js (the staging API
// process) and from production ecosystem.config.js:
// - Different process name (`ongc-web-staging`) so `pm2` commands can
//   never accidentally target the wrong environment.
// - Bound to 127.0.0.1 only — not directly internet-facing. Public access
//   goes through nginx/staging-web.conf, proxying port 80 to this process.
// - Fork mode / single instance — staging doesn't need production's
//   throughput.
//
// No secrets here — NEXT_PUBLIC_API_URL is baked in at BUILD time (see
// docs/STAGING_DEPLOYMENT.md), not read from this file at runtime.
//
// cwd/script combination verified working: standalone output lands at
// apps/web/.next/standalone/apps/web/server.js because
// apps/web/next.config.mjs's outputFileTracingRoot points at the monorepo
// root (required for hoisted node_modules / workspace packages to be
// traced correctly into the standalone bundle).
module.exports = {
  apps: [
    {
      name: 'ongc-web-staging',
      cwd: './apps/web/.next/standalone/apps/web',
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
