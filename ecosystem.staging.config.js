// PM2 process definition for the STAGING API only.
//
// Deliberately separate from the production `ecosystem.config.js`:
// - Different process name (`ongc-api-staging` vs `ongc-api`) so `pm2`
//   commands can never accidentally target the wrong environment.
// - Different port (3011 vs 3001) so both can run on the same VPS without
//   colliding.
// - Fork mode / single instance, not cluster — staging doesn't need
//   production's throughput, and this keeps resource usage predictable on
//   a VPS that may also be running the production process.
//
// Real secrets (DATABASE_URL, JWT_SECRET, REDIS_URL, etc.) are NOT set
// here. They live in apps/api/.env on the VPS (created once during setup,
// never committed) and are loaded by NestJS's ConfigModule at boot, same
// as production. This file only sets non-secret process-level config.
//
// NOTE: the compiled entry point is genuinely `dist/apps/api/src/main.js`,
// not `dist/main.js` — see docs/STAGING_DEPLOYMENT.md "Known issue" section
// for why (a pre-existing tsconfig path-mapping quirk, confirmed by a local
// clean build; not something introduced by this deployment work).
module.exports = {
  apps: [
    {
      name: 'ongc-api-staging',
      cwd: './apps/api',
      script: 'dist/apps/api/src/main.js',
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
        PORT: 3011,
      },
      error_file: '../../logs/staging-api-error.log',
      out_file: '../../logs/staging-api-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
