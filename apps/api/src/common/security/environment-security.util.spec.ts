import { getAllowedOrigins, isOriginAllowed, isSwaggerEnabled } from './environment-security.util';

describe('environment-security.util', () => {
  describe('isSwaggerEnabled', () => {
    it('is disabled in production', () => {
      expect(isSwaggerEnabled('production')).toBe(false);
    });

    it('is enabled in staging', () => {
      expect(isSwaggerEnabled('staging')).toBe(true);
    });

    it('is enabled in development', () => {
      expect(isSwaggerEnabled('development')).toBe(true);
    });

    it('is enabled when NODE_ENV is unset', () => {
      expect(isSwaggerEnabled(undefined)).toBe(true);
    });
  });

  describe('getAllowedOrigins', () => {
    it('parses a comma-separated CORS_ORIGINS list, trimming whitespace', () => {
      expect(getAllowedOrigins('production', ' https://a.example , https://b.example ')).toEqual([
        'https://a.example',
        'https://b.example',
      ]);
    });

    it('returns an empty list in production when CORS_ORIGINS is unset', () => {
      expect(getAllowedOrigins('production', undefined)).toEqual([]);
    });

    it('returns an empty list in staging when CORS_ORIGINS is unset (no bypass)', () => {
      expect(getAllowedOrigins('staging', undefined)).toEqual([]);
    });

    it('falls back to localhost:3000 in development when CORS_ORIGINS is unset', () => {
      expect(getAllowedOrigins('development', undefined)).toEqual(['http://localhost:3000']);
    });
  });

  describe('isOriginAllowed', () => {
    it('allows requests with no Origin header regardless of environment', () => {
      expect(isOriginAllowed(undefined, 'production', undefined)).toBe(true);
      expect(isOriginAllowed(undefined, 'staging', 'https://trusted.example')).toBe(true);
    });

    it('allows a configured origin in production', () => {
      expect(isOriginAllowed('https://ongcnavratri.reworkzone.in', 'production', 'https://ongcnavratri.reworkzone.in')).toBe(
        true,
      );
    });

    it('rejects an untrusted origin in production', () => {
      expect(isOriginAllowed('https://evil.example', 'production', 'https://ongcnavratri.reworkzone.in')).toBe(false);
    });

    it('allows a configured origin in staging', () => {
      expect(isOriginAllowed('https://greenyellow-bison-537983.hostingersite.com', 'staging', 'https://greenyellow-bison-537983.hostingersite.com')).toBe(
        true,
      );
    });

    it('rejects an untrusted origin in staging (no more implicit allow-all)', () => {
      expect(isOriginAllowed('https://evil.example', 'staging', 'https://greenyellow-bison-537983.hostingersite.com')).toBe(
        false,
      );
    });

    it('rejects any origin in staging when CORS_ORIGINS is unset', () => {
      expect(isOriginAllowed('https://anything.example', 'staging', undefined)).toBe(false);
    });

    it('allows any origin in development for convenience', () => {
      expect(isOriginAllowed('https://random-dev-tool.example', 'development', undefined)).toBe(true);
    });
  });
});
