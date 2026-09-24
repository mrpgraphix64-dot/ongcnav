import { getRequiredJwtSecret } from './jwt-secret.util';

function configWith(value: string | undefined) {
  return { get: () => value };
}

describe('getRequiredJwtSecret', () => {
  it('throws when JWT_SECRET is missing (undefined)', () => {
    expect(() => getRequiredJwtSecret(configWith(undefined))).toThrow(
      /JWT_SECRET environment variable is required/,
    );
  });

  it('throws when JWT_SECRET is an empty string', () => {
    expect(() => getRequiredJwtSecret(configWith(''))).toThrow(
      /JWT_SECRET environment variable is required/,
    );
  });

  it('throws when JWT_SECRET is only whitespace', () => {
    expect(() => getRequiredJwtSecret(configWith('   '))).toThrow(
      /JWT_SECRET environment variable is required/,
    );
  });

  it('throws when JWT_SECRET is shorter than 32 characters', () => {
    expect(() => getRequiredJwtSecret(configWith('too-short-secret'))).toThrow(
      /at least 32 characters/,
    );
  });

  it('throws when JWT_SECRET is the previous hardcoded fallback value', () => {
    expect(() => getRequiredJwtSecret(configWith('ongc-navratri-jwt-secret-key-2026'))).toThrow(
      /known placeholder\/default value/,
    );
  });

  it('throws when JWT_SECRET is the root .env.example placeholder, even though it happens to be long enough', () => {
    expect(() =>
      getRequiredJwtSecret(configWith('CHANGE_THIS_TO_A_CRYPTOGRAPHICALLY_SECURE_64_CHAR_SECRET_KEY')),
    ).toThrow(/known placeholder\/default value/);
  });

  it('throws when JWT_SECRET is the apps/api .env.example placeholder', () => {
    expect(() =>
      getRequiredJwtSecret(configWith('replace_with_secure_random_64_character_hex_key')),
    ).toThrow(/known placeholder\/default value/);
  });

  it('never includes the actual secret value in the thrown error message', () => {
    const secret = 'a-short-but-real-looking-secret-value';
    try {
      getRequiredJwtSecret(configWith('short'));
    } catch (err: any) {
      expect(err.message).not.toContain(secret);
      expect(err.message).not.toContain('short');
    }
  });

  it('returns the secret unchanged when it is long enough and not a known placeholder', () => {
    const secret = 'a'.repeat(64);
    expect(getRequiredJwtSecret(configWith(secret))).toBe(secret);
  });
});
