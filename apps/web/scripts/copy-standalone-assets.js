// Next.js's `output: 'standalone'` deliberately does not copy
// `.next/static` or `public/` into the standalone bundle — this is
// documented, expected behavior, not a bug: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
// Without this step, the standalone server starts fine but every static
// JS/CSS chunk and every file under `public/` 404s at runtime.
//
// Because outputFileTracingRoot points at the monorepo root (required so
// standalone tracing finds hoisted node_modules and sibling workspace
// packages), the standalone output for this app lands at
// `.next/standalone/apps/web/`, not `.next/standalone/` directly.
const fs = require('fs');
const path = require('path');

const webDir = __dirname && path.dirname(__dirname);
const standaloneAppDir = path.join(webDir, '.next', 'standalone', 'apps', 'web');

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) {
    console.warn(`[copy-standalone-assets] Skipping missing source: ${from}`);
    return;
  }
  fs.cpSync(from, to, { recursive: true });
  console.log(`[copy-standalone-assets] Copied ${from} -> ${to}`);
}

if (!fs.existsSync(standaloneAppDir)) {
  console.warn(
    `[copy-standalone-assets] ${standaloneAppDir} does not exist — is output: 'standalone' set and did the build produce standalone output? Skipping.`,
  );
  process.exit(0);
}

copyIfExists(path.join(webDir, '.next', 'static'), path.join(standaloneAppDir, '.next', 'static'));
copyIfExists(path.join(webDir, 'public'), path.join(standaloneAppDir, 'public'));
