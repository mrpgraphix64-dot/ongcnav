import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces .next/standalone/server.js — a self-contained Node server
  // Hostinger Web App Hosting (and the deploy/staging-deploy.sh
  // verification build) can run directly, instead of requiring `next
  // start` plus the full node_modules tree. /ticket/[token] stays a
  // normal dynamic route — standalone output still runs the full Next.js
  // server, it isn't a static export.
  output: 'standalone',
  // This is an npm workspace monorepo: apps/web's own node_modules is not
  // self-contained — dependencies get hoisted to the repo root, and
  // @ongc/shared-types lives in a sibling workspace (packages/shared-types).
  // outputFileTracingRoot must point at the repo root, not apps/web itself,
  // so Next's file tracing walks up far enough to find and copy those
  // hoisted/workspace files into the standalone output. Pointed at apps/web
  // itself (the previous value), the trace could miss them.
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
