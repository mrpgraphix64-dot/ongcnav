// Resolves JWT_SECRET from the environment and fails fast (throws
// synchronously, during module construction — before the app starts
// listening) if it is missing or insecure. There is no hardcoded default
// value: a missing JWT_SECRET must stop the application from starting,
// not silently fall back to a well-known string.
//
// Error messages never include the actual configured value — only
// whether it was missing, too short, or matched a known placeholder.

const MIN_JWT_SECRET_LENGTH = 32;

// Values that must never be usable as a real secret: the previous
// hardcoded fallback, and the placeholder strings shipped in .env.example
// files (in case someone copies the template without changing them).
const KNOWN_INSECURE_VALUES = new Set([
  'ongc-navratri-jwt-secret-key-2026',
  'CHANGE_THIS_TO_A_CRYPTOGRAPHICALLY_SECURE_64_CHAR_SECRET_KEY',
  'replace_with_secure_random_64_character_hex_key',
]);

export interface JwtSecretConfigSource {
  get(key: string): string | undefined;
}

export function getRequiredJwtSecret(configService: JwtSecretConfigSource): string {
  const secret = configService.get('JWT_SECRET');

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'JWT_SECRET environment variable is required and must not be empty. Refusing to start.',
    );
  }

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET environment variable must be at least ${MIN_JWT_SECRET_LENGTH} characters long. Refusing to start.`,
    );
  }

  if (KNOWN_INSECURE_VALUES.has(secret)) {
    throw new Error(
      'JWT_SECRET environment variable is set to a known placeholder/default value. Refusing to start.',
    );
  }

  return secret;
}
