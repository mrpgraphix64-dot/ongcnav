import fs from 'fs';
import path from 'path';

// Mock next/navigation redirect
const mockRedirect = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import RegisterRedirectPage from './page';

describe('Public Commercial /register Backward Compatibility & Redirect', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  it('next.config.mjs configures permanent HTTP redirect from /register to /bookpass', () => {
    const configPath = path.resolve(__dirname, '../../../next.config.mjs');
    const content = fs.readFileSync(configPath, 'utf-8');

    expect(content).toContain("source: '/register'");
    expect(content).toContain("destination: '/bookpass'");
    expect(content).toContain('permanent: true');
  });

  it('RegisterRedirectPage App Router server component invokes redirect to /bookpass', () => {
    RegisterRedirectPage();
    expect(mockRedirect).toHaveBeenCalledWith('/bookpass');
  });

  it('preserves /employee/register and does not redirect employee registration', () => {
    const configPath = path.resolve(__dirname, '../../../next.config.mjs');
    const content = fs.readFileSync(configPath, 'utf-8');

    // /employee/register must NOT be redirected
    expect(content).not.toContain("source: '/employee/register'");
  });
});
