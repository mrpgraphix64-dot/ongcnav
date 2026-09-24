// Pure decision helpers extracted from main.ts's bootstrap so CORS/Swagger
// behavior can be unit-tested without spinning up the whole Nest app.
// Behavior is unchanged from what main.ts inlined before — only the
// computation moved, not the logic.

export function getAllowedOrigins(
  nodeEnv: string | undefined,
  corsOriginsEnv: string | undefined,
): string[] {
  if (corsOriginsEnv) {
    return corsOriginsEnv
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return nodeEnv === 'development' ? ['http://localhost:3000'] : [];
}

export function isOriginAllowed(
  origin: string | undefined,
  nodeEnv: string | undefined,
  corsOriginsEnv: string | undefined,
): boolean {
  // No Origin header at all (server-to-server calls, curl, mobile apps).
  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins(nodeEnv, corsOriginsEnv);
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Only 'development' gets a permissive fallback. Production and staging
  // must match an explicitly configured origin — no bypass for any
  // non-production environment.
  return nodeEnv === 'development';
}

export function isSwaggerEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}
