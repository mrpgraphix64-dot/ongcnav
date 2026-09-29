import React from 'react';
import ReactDOMServer from 'react-dom/server';
import AdminStaffPage from './page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

// Mock react-dom createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: any) => node,
}));

(global as any).fetch = jest.fn((url: string) => {
  if (url.includes('/admin/staff')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: '1',
            name: 'Super Admin User',
            email: 'superadmin@ongc.internal',
            staffId: 'SA-001',
            role: 'SUPER_ADMIN',
            status: 'active',
            isActive: true,
            gates: [],
            assignedGates: [],
          },
          {
            id: '2',
            name: 'Gate Scanner 1',
            email: 'scanner1@ongc.co.in',
            staffId: 'STF-002',
            role: 'SCANNER_STAFF',
            status: 'active',
            isActive: true,
            gates: [{ id: '10', name: 'Main Gate', code: 'G-01' }],
            assignedGates: [{ id: '10', name: 'Main Gate', code: 'G-01' }],
          },
        ]),
    });
  }
  if (url.includes('/admin/gates')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    });
  }
  if (url.includes('/auth/me')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          user: {
            id: '1',
            name: 'Super Admin User',
            email: 'superadmin@ongc.internal',
            role: 'SUPER_ADMIN',
          },
        }),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

describe('AdminStaffPage Internal Staff Only & UI Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders staff page with internal staff options and excludes agent roles from selection', () => {
    const html = ReactDOMServer.renderToStaticMarkup(<AdminStaffPage />);

    // Internal staff roles must be present in the filter dropdown
    expect(html).toContain('Super Admin');
    expect(html).toContain('Event Admin');
    expect(html).toContain('E-Pass Admin');
    expect(html).toContain('Employee Admin');
    expect(html).toContain('Gate Manager');
    expect(html).toContain('Scanner Staff');
    expect(html).toContain('Registration Staff');
    expect(html).toContain('Report Viewer');

    // Agent roles must NOT be present in Staff Management filter or role selections
    expect(html).not.toContain('E-Pass Agent');
    expect(html).not.toContain('E-Pass Sub-Agent');
    expect(html).not.toContain('COMMERCIAL_AGENT');
    expect(html).not.toContain('COMMERCIAL_SUB_AGENT');
  });

  it('renders staff page stats and domain administrator section', () => {
    const html = ReactDOMServer.renderToStaticMarkup(<AdminStaffPage />);

    expect(html).toContain('Total Staff');
    expect(html).toContain('Active Operators');
    expect(html).toContain('Domain Administrators');
    expect(html).toContain('E-Pass Admin');
    expect(html).toContain('Employee Admin');
  });
});
