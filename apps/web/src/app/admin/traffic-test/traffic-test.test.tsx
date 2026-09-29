import React from 'react';
import ReactDOMServer from 'react-dom/server';
import AdminTrafficTestPage from './page';
import { LoadTestMode, LoadTestScenario } from '@ongc/shared-types';

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

(global as any).fetch = jest.fn((url: string) => {
  if (url.includes('/admin/traffic-test/runs')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: '1',
            scenario: 'NORMAL',
            mode: 'REAL_HTTP',
            status: 'COMPLETED',
            simulatedUsers: 100,
            totalRequests: '100',
            successfulRequests: '100',
            duplicateRequests: '0',
            invalidRequests: '0',
            errorRequests: '0',
            requestsPerSecond: 50,
            avgResponseTimeMs: 12,
            bytesTransferred: '1048576',
          },
        ]),
    });
  }
  if (url.includes('/admin/gates')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ id: '1', name: 'Main Gate 1' }]),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

describe('AdminTrafficTestPage', () => {
  it('renders all canonical scenarios and execution modes', () => {
    const html = ReactDOMServer.renderToStaticMarkup(<AdminTrafficTestPage />);

    // Check title and labels
    expect(html).toContain('Scanner Verification &amp; Traffic Test Lab');
    expect(html).toContain('Configure New Traffic Test Run');
    expect(html).toContain('Execution Runs History');

    // Canonical scenarios must be present as option values
    expect(html).toContain(`value="${LoadTestScenario.NORMAL}"`);
    expect(html).toContain(`value="${LoadTestScenario.DUPLICATE}"`);
    expect(html).toContain(`value="${LoadTestScenario.INVALID_QR}"`);
    expect(html).toContain(`value="${LoadTestScenario.NOT_BOOKED}"`);
    expect(html).toContain(`value="${LoadTestScenario.PEAK_BURST}"`);
    expect(html).toContain(`value="${LoadTestScenario.MIXED}"`);

    // Verify friendly labels
    expect(html).toContain('NORMAL (1 User → 1 Check-in)');
    expect(html).toContain('DUPLICATE (1 User → 2 Requests)');
    expect(html).toContain('INVALID QR (Malformed / Unauthorized)');
    expect(html).toContain('NOT BOOKED (Valid Pass, Wrong Date)');
    expect(html).toContain('PEAK BURST (Concurrency Spike)');
    expect(html).toContain('MIXED (70% Norm, 20% Dup, 10% Inv)');

    // Canonical modes must be present as option values
    expect(html).toContain(`value="${LoadTestMode.REAL_HTTP}"`);
    expect(html).toContain(`value="${LoadTestMode.DRY_RUN}"`);

    // Verify mode labels
    expect(html).toContain('REAL HTTP (Network Traffic + Latency)');
    expect(html).toContain('DRY RUN (In-Memory Simulation, 0 MB)');
  });

  it('uses exact canonical enum strings', () => {
    expect(LoadTestScenario.NORMAL).toBe('NORMAL');
    expect(LoadTestScenario.DUPLICATE).toBe('DUPLICATE');
    expect(LoadTestScenario.INVALID_QR).toBe('INVALID_QR');
    expect(LoadTestScenario.NOT_BOOKED).toBe('NOT_BOOKED');
    expect(LoadTestScenario.PEAK_BURST).toBe('PEAK_BURST');
    expect(LoadTestScenario.MIXED).toBe('MIXED');

    expect(LoadTestMode.DRY_RUN).toBe('DRY_RUN');
    expect(LoadTestMode.REAL_HTTP).toBe('REAL_HTTP');
  });
});
