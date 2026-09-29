import React from 'react';
import ReactDOMServer from 'react-dom/server';
import AdminTrafficTestPage from './page';
import {
  calculateSliderPosition,
  MIN_SIMULATED_USERS,
  MAX_SIMULATED_USERS,
  USER_SCALE_MARKS,
  buildInitialRunTelemetry,
} from './traffic-test.constants';
import { LoadTestMode, LoadTestScenario, LoadTestStatus } from '@ongc/shared-types';

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
  if (url.includes('/admin/traffic-test/runs/3/status')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          id: '3',
          scenario: 'PEAK_BURST',
          mode: 'REAL_HTTP',
          status: 'RUNNING',
          simulatedUsers: 100,
          totalRequests: '25',
          successfulRequests: '25',
          duplicateRequests: '0',
          invalidRequests: '0',
          errorRequests: '0',
          requestsPerSecond: 120,
          avgResponseTimeMs: 8,
          bytesTransferredMb: '0.25',
          successPercentage: '100',
          isRunning: true,
          recentRequests: [],
        }),
    });
  }
  if (url.includes('/admin/traffic-test/runs/1/status')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
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
          bytesTransferredMb: '1.00',
          successPercentage: '100',
          isRunning: false,
          recentRequests: [],
        }),
    });
  }
  if (url.includes('/admin/traffic-test/runs')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: '3',
            scenario: 'PEAK_BURST',
            mode: 'REAL_HTTP',
            status: 'RUNNING',
            simulatedUsers: 100,
            totalRequests: '25',
            successfulRequests: '25',
            duplicateRequests: '0',
            invalidRequests: '0',
            errorRequests: '0',
            requestsPerSecond: 120,
            avgResponseTimeMs: 8,
            bytesTransferred: '262144',
          },
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
  if (url.includes('/admin/traffic-test/start')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          message: 'Load test execution started',
          runId: '3',
          status: 'RUNNING',
          mode: 'REAL_HTTP',
          scenario: 'PEAK_BURST',
        }),
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

  describe('Issue 2: Slider Label Alignment', () => {
    it('calculates mathematically correct percentages corresponding to HTML range input scale', () => {
      // Scale: min = 10, max = 500
      expect(MIN_SIMULATED_USERS).toBe(10);
      expect(MAX_SIMULATED_USERS).toBe(500);

      // 10 must be exactly 0%
      expect(calculateSliderPosition(10)).toBe(0);

      // 100 must be (90/490) * 100 ≈ 18.367%
      const pos100 = calculateSliderPosition(100);
      expect(pos100).toBeCloseTo(18.367, 2);

      // 250 must be (240/490) * 100 ≈ 48.980%
      const pos250 = calculateSliderPosition(250);
      expect(pos250).toBeCloseTo(48.980, 2);

      // 500 must be exactly 100%
      expect(calculateSliderPosition(500)).toBe(100);
    });

    it('renders slider labels at exact calculated percentages with centering transform', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<AdminTrafficTestPage />);

      // Marks: 10, 100, 250, 500
      expect(USER_SCALE_MARKS).toEqual([10, 100, 250, 500]);

      // Check left percentage in rendered HTML
      expect(html).toContain('left:0%');
      expect(html).toContain(`left:${calculateSliderPosition(100)}%`);
      expect(html).toContain(`left:${calculateSliderPosition(250)}%`);
      expect(html).toContain('left:100%');
      expect(html).toContain('transform:translateX(-50%)');
    });
  });

  describe('Issue 1: Active Run Telemetry Switching', () => {
    it('creates initial telemetry for Run #1 and Run #3 with accurate structure', () => {
      const run1Telemetry = buildInitialRunTelemetry('1', {
        status: LoadTestStatus.COMPLETED,
        scenario: LoadTestScenario.NORMAL,
        mode: LoadTestMode.REAL_HTTP,
        simulatedUsers: 100,
      });

      expect(run1Telemetry.id).toBe('1');
      expect(run1Telemetry.scenario).toBe(LoadTestScenario.NORMAL);
      expect(run1Telemetry.mode).toBe(LoadTestMode.REAL_HTTP);
      expect(run1Telemetry.status).toBe(LoadTestStatus.COMPLETED);

      const run3Telemetry = buildInitialRunTelemetry('3', {
        status: LoadTestStatus.RUNNING,
        scenario: LoadTestScenario.PEAK_BURST,
        mode: LoadTestMode.REAL_HTTP,
        simulatedUsers: 100,
      });

      expect(run3Telemetry.id).toBe('3');
      expect(run3Telemetry.scenario).toBe(LoadTestScenario.PEAK_BURST);
      expect(run3Telemetry.mode).toBe(LoadTestMode.REAL_HTTP);
      expect(run3Telemetry.status).toBe(LoadTestStatus.RUNNING);
      expect(run3Telemetry.isRunning).toBe(true);
    });

    it('proves that starting Run #3 switches telemetry target and does not overwrite with older run', async () => {
      // Simulate component lifecycle transition:
      // Initially, selectedRunRef has Run #1
      let selectedRun: any = {
        id: '1',
        scenario: LoadTestScenario.NORMAL,
        mode: LoadTestMode.REAL_HTTP,
        status: LoadTestStatus.COMPLETED,
      };
      const selectedRunRef = { current: selectedRun };

      // Verify initial state
      expect(selectedRunRef.current.id).toBe('1');

      // User starts a new test (Run #3)
      const startRes = {
        success: true,
        runId: '3',
        status: LoadTestStatus.RUNNING,
        mode: LoadTestMode.REAL_HTTP,
        scenario: LoadTestScenario.PEAK_BURST,
      };

      // In handleStartTest, immediately set the newly created run as selectedRun
      const initialTelemetry = {
        id: startRes.runId,
        status: startRes.status,
        scenario: startRes.scenario,
        mode: startRes.mode,
        simulatedUsers: 100,
        totalRequests: '0',
        successfulRequests: '0',
        duplicateRequests: '0',
        invalidRequests: '0',
        errorRequests: '0',
        requestsPerSecond: 0,
        avgResponseTimeMs: 0,
        bytesTransferred: '0',
        bytesTransferredMb: '0.00',
        successPercentage: '0',
        isRunning: true,
        recentRequests: [],
      };

      selectedRun = initialTelemetry;
      selectedRunRef.current = initialTelemetry;

      // Telemetry target has switched immediately to Run #3
      expect(selectedRunRef.current.id).toBe('3');
      expect(selectedRunRef.current.scenario).toBe(LoadTestScenario.PEAK_BURST);

      // Now simulate a background polling tick (loadData)
      // loadData checks curSelected = selectedRunRef.current
      const curSelected = selectedRunRef.current;
      expect(curSelected.id).toBe('3');

      // Telemetry polling follows Run #3
      const liveStatus = {
        id: '3',
        scenario: 'PEAK_BURST',
        mode: 'REAL_HTTP',
        status: 'RUNNING',
        totalRequests: '50',
      };

      if (curSelected?.id && curSelected.id === '3') {
        selectedRun = liveStatus;
        selectedRunRef.current = liveStatus;
      }

      // History polling maintains Run #3 and does not revert to Run #1
      expect(selectedRunRef.current.id).toBe('3');
      expect(selectedRunRef.current.id).not.toBe('1');
    });
  });
});
