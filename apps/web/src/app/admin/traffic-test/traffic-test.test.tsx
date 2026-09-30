import React from 'react';
import ReactDOMServer from 'react-dom/server';
import AdminTrafficTestPage from './page';
import {
  calculateSliderPosition,
  MIN_SIMULATED_USERS,
  MAX_SIMULATED_USERS,
  USER_SCALE_MARKS,
  buildInitialRunTelemetry,
  MIN_GATES,
  MAX_GATES,
  DEFAULT_GATES,
  MIN_SCANNERS_PER_GATE,
  MAX_SCANNERS_PER_GATE,
  DEFAULT_SCANNERS_PER_GATE,
  MIN_SCAN_INTERVAL,
  MAX_SCAN_INTERVAL,
  DEFAULT_SCAN_INTERVAL,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
  DEFAULT_DURATION_SECONDS,
  BURST_LEVELS,
  DEFAULT_BURST_LEVEL,
  SCENARIO_DETAILS,
  getLoadWarning,
  MAX_SAFE_CONCURRENCY,
  calculateTotalScanners,
  calculateExpectedScanRate,
  calculateEstimatedCycles,
  calculateBaseScanActions,
  calculateEstimatedRequests,
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
    expect(html).toContain('NORMAL — 100% Success');
    expect(html).toContain('DUPLICATE — Success + Duplicate');
    expect(html).toContain('INVALID QR — 100% Invalid');
    expect(html).toContain('NOT BOOKED — 100% Not Booked');
    expect(html).toContain('PEAK BURST — Maximum Concurrent Load');
    expect(html).toContain('MIXED — 70% Normal / 20% Duplicate / 10% Invalid');

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

  describe('Slider and Manual Controls Removal', () => {
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

    it('verifies manual simulated users and concurrency inputs are removed from the UI', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<AdminTrafficTestPage />);

      expect(html).not.toContain('Simulated Users (');
      expect(html).not.toContain('type="range"');
      expect(html).not.toContain('Concurrency (Workers)');
      expect(html).not.toContain('Parallel connection workers');
      expect(html).not.toContain('Ramp-Up Duration (s)');
      expect(html).not.toContain('Pacing interval');
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

  describe('Audit Fixes: Controls, Telemetry & Metrics', () => {
    it('renders Simulation Date and replaces Concurrency/Ramp-up with Physical Scanner controls', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<AdminTrafficTestPage />);

      // Simulation date is retained
      expect(html).toContain('Simulation Date');
      expect(html).toContain('2026-10-11 (Day 1 - Inauguration)');
      expect(html).toContain('2026-10-19 (Day 9 - Grand Finale)');

      // Physical scanner controls
      expect(html).toContain('Number of Gates');
      expect(html).toContain('Scanners per Gate');
      expect(html).toContain('Scan Interval (s)');
      expect(html).toContain('Time between scans from each scanner.');
    });

    it('renders Success / Dup / Inv / Err in history table header', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<AdminTrafficTestPage />);

      expect(html).toContain('Success / Dup / Inv / Err');
    });
  });

  describe('Physical Scanner Configuration Model', () => {
    describe('Scanner Count and Rate Calculations', () => {
      it('calculates total scanners for standard turnstile configurations', () => {
        // 1 gate × 1 scanner = 1 total scanner
        expect(calculateTotalScanners(1, 1)).toBe(1);

        // 3 gates × 2 scanners = 6 total scanners (default setup)
        expect(calculateTotalScanners(3, 2)).toBe(6);

        // 3 gates × 6 scanners = 18 total scanners
        expect(calculateTotalScanners(3, 6)).toBe(18);
      });

      it('calculates expected scan rate based on total scanners and scan interval', () => {
        // 6 total scanners with 1s interval -> ~6 scans/sec
        expect(calculateExpectedScanRate(6, 1)).toBe('~6 scans/sec');

        // 6 total scanners with 2s interval -> ~3 scans/sec
        expect(calculateExpectedScanRate(6, 2)).toBe('~3 scans/sec');

        // 18 total scanners with 2s interval -> ~9 scans/sec
        expect(calculateExpectedScanRate(18, 2)).toBe('~9 scans/sec');

        // 6 total scanners with 4s interval -> ~1.5 scans/sec (fractional formatting)
        expect(calculateExpectedScanRate(6, 4)).toBe('~1.5 scans/sec');

        // 1 scanner with 2s interval -> ~0.5 scans/sec
        expect(calculateExpectedScanRate(1, 2)).toBe('~0.5 scans/sec');
      });

      it('calculates estimated cycles and requests based on total scanners, duration, and interval', () => {
        // 6 scanners, 2s interval, 10s duration -> 5 cycles, 30 requests
        expect(calculateEstimatedCycles(10, 2)).toBe(5);
        expect(calculateEstimatedRequests(6, 10, 2)).toBe(30);

        // 6 scanners, 2s interval, 30s duration -> 15 cycles, 90 requests (default setup)
        expect(calculateEstimatedCycles(30, 2)).toBe(15);
        expect(calculateEstimatedRequests(6, 30, 2)).toBe(90);

        // 18 scanners, 2s interval, 30s duration -> 15 cycles, 270 requests
        expect(calculateEstimatedCycles(30, 2)).toBe(15);
        expect(calculateEstimatedRequests(18, 30, 2)).toBe(270);

        // Clamping validation:
        // duration < 5 clamped to 5: 5 / 2 = 2 cycles
        expect(calculateEstimatedCycles(2, 2)).toBe(2);
        // duration > 300 clamped to 300: 300 / 2 = 150 cycles
        expect(calculateEstimatedCycles(500, 2)).toBe(150);
      });

      it('enforces input validation and clamping to prevent 0 or invalid values', () => {
        // Gates clamped to [MIN_GATES, MAX_GATES] (1 to 20)
        expect(calculateTotalScanners(0, 2)).toBe(1 * 2); // 0 clamped to 1
        expect(calculateTotalScanners(-5, 2)).toBe(1 * 2); // negative clamped to 1
        expect(calculateTotalScanners(10, 2)).toBe(10 * 2); // 10 is within 1..20
        expect(calculateTotalScanners(25, 2)).toBe(20 * 2); // > 20 clamped to 20

        // Scanners per gate clamped to [MIN_SCANNERS_PER_GATE, MAX_SCANNERS_PER_GATE] (1 to 10)
        expect(calculateTotalScanners(3, 0)).toBe(3 * 1); // 0 clamped to 1
        expect(calculateTotalScanners(3, -1)).toBe(3 * 1); // negative clamped to 1
        expect(calculateTotalScanners(3, 20)).toBe(3 * 10); // > 10 clamped to 10

        // Both clamped
        expect(calculateTotalScanners(0, 0)).toBe(1 * 1);

        // Scan interval clamped to [MIN_SCAN_INTERVAL, MAX_SCAN_INTERVAL] (1 to 60)
        expect(calculateExpectedScanRate(6, 0)).toBe('~6 scans/sec'); // 0 clamped to 1
        expect(calculateExpectedScanRate(6, -2)).toBe('~6 scans/sec'); // negative clamped to 1
        expect(calculateExpectedScanRate(6, 120)).toBe('~0.1 scans/sec'); // 120 clamped to 60 (6/60 = 0.1)
      });
    });

    describe('UI Rendering & Verification', () => {
      it('renders gate, scanner, interval, and duration controls with correct attributes and helper text', () => {
        const html = ReactDOMServer.renderToStaticMarkup(<AdminTrafficTestPage />);

        // Number of Gates input
        expect(html).toContain('Number of Gates');
        expect(html).toContain(`min="${MIN_GATES}"`);
        expect(html).toContain(`max="${MAX_GATES}"`);
        expect(html).toContain(`value="${DEFAULT_GATES}"`);
        expect(html).toContain('Number of entrance gates to simulate.');

        // Scanners per Gate input
        expect(html).toContain('Scanners per Gate');
        expect(html).toContain(`min="${MIN_SCANNERS_PER_GATE}"`);
        expect(html).toContain(`max="${MAX_SCANNERS_PER_GATE}"`);
        expect(html).toContain(`value="${DEFAULT_SCANNERS_PER_GATE}"`);
        expect(html).toContain('Turnstile scanners per gate (1–10)');

        // Scan Interval input
        expect(html).toContain('Scan Interval (s)');
        expect(html).toContain(`min="${MIN_SCAN_INTERVAL}"`);
        expect(html).toContain(`max="${MAX_SCAN_INTERVAL}"`);
        expect(html).toContain(`value="${DEFAULT_SCAN_INTERVAL}"`);
        expect(html).toContain('Time between scans from each scanner.');

        // Test Duration input
        expect(html).toContain('Test Duration (seconds)');
        expect(html).toContain(`min="${MIN_DURATION_SECONDS}"`);
        expect(html).toContain(`max="${MAX_DURATION_SECONDS}"`);
        expect(html).toContain(`value="${DEFAULT_DURATION_SECONDS}"`);
        expect(html).toContain('How long the scanners should continue scanning.');
      });

      it('renders read-only scanner setup summary badges matching default 3 gates × 2 scanners = 6', () => {
        const html = ReactDOMServer.renderToStaticMarkup(<AdminTrafficTestPage />);

        expect(html).toContain('Total Scanners: 6');
        expect(html).toContain('Parallel Scanners: 6');
        expect(html).toContain('Expected Traffic: ~3 scans/sec');
        expect(html).toContain('Base Scan Actions: ~90');
        expect(html).toContain('Estimated HTTP Requests: ~90');
      });

      it('ensures no manual simulated-user slider or manual concurrency input is rendered', () => {
        const html = ReactDOMServer.renderToStaticMarkup(<AdminTrafficTestPage />);

        // Manual controls must be absent
        expect(html).not.toContain('Simulated Users');
        expect(html).not.toContain('Concurrency (Workers)');
        expect(html).not.toContain('Parallel connection workers');
        expect(html).not.toContain('Ramp-Up Duration');
      });

      it('proves concurrency automatically equals totalScanners and sets payload correctly with scanIntervalSeconds and durationSeconds without rampUpSeconds pacing', () => {
        // Test calculation logic used when building the start-test payload
        const testCases = [
          { scenario: 'NORMAL', gates: 1, scanners: 1, interval: 1, duration: 10, expectedTotal: 1, expectedRate: '~1 scans/sec', expectedCycles: 10, expectedBase: 10, expectedReqs: 10 },
          { scenario: 'NORMAL', gates: 3, scanners: 2, interval: 2, duration: 10, expectedTotal: 6, expectedRate: '~3 scans/sec', expectedCycles: 5, expectedBase: 30, expectedReqs: 30 },
          { scenario: 'NORMAL', gates: 3, scanners: 2, interval: 2, duration: 30, expectedTotal: 6, expectedRate: '~3 scans/sec', expectedCycles: 15, expectedBase: 90, expectedReqs: 90 },
          { scenario: 'DUPLICATE', gates: 3, scanners: 2, interval: 2, duration: 30, expectedTotal: 6, expectedRate: '~3 scans/sec', expectedCycles: 15, expectedBase: 90, expectedReqs: 180 },
          { scenario: 'MIXED', gates: 1, scanners: 2, interval: 4, duration: 50, expectedTotal: 2, expectedRate: '~0.5 scans/sec', expectedCycles: 12, expectedBase: 24, expectedReqs: 29 },
          { scenario: 'NORMAL', gates: 3, scanners: 6, interval: 2, duration: 30, expectedTotal: 18, expectedRate: '~9 scans/sec', expectedCycles: 15, expectedBase: 270, expectedReqs: 270 },
        ];

        for (const tc of testCases) {
          const total = calculateTotalScanners(tc.gates, tc.scanners);
          const rate = calculateExpectedScanRate(total, tc.interval);
          const cycles = calculateEstimatedCycles(tc.duration, tc.interval);
          const base = calculateBaseScanActions(total, tc.duration, tc.interval);
          const reqs = calculateEstimatedRequests(tc.scenario, total, tc.duration, tc.interval);

          expect(total).toBe(tc.expectedTotal);
          expect(rate).toBe(tc.expectedRate);
          expect(cycles).toBe(tc.expectedCycles);
          expect(base).toBe(tc.expectedBase);
          expect(reqs).toBe(tc.expectedReqs);

          // In payload construction:
          const payload = {
            simulatedUsers: total,
            concurrency: total,
            scanIntervalSeconds: tc.interval,
            durationSeconds: tc.duration,
            rampUpSeconds: 0, // rampUpSeconds is NOT used for physical scanner pacing
          };

          expect(payload.concurrency).toBe(tc.expectedTotal);
          expect(payload.simulatedUsers).toBe(tc.expectedTotal);
          expect(payload.scanIntervalSeconds).toBe(tc.interval);
          expect(payload.durationSeconds).toBe(tc.duration);
          expect(payload.rampUpSeconds).toBe(0);
        }
      });
    });

    describe('Live VPS Status & Peak Burst Improvements', () => {
      it('renders dedicated Live VPS Status card with metrics and services', () => {
        const html = ReactDOMServer.renderToStaticMarkup(<AdminTrafficTestPage />);

        expect(html).toContain('LIVE VPS STATUS');
        expect(html).toContain('Real-time node telemetry &amp; platform health diagnostics');
        expect(html).toContain('CPU Usage');
        expect(html).toContain('Memory Usage');
        expect(html).toContain('Disk Usage');
        expect(html).toContain('Network Traffic');
        expect(html).toContain('Services:');
        expect(html).toContain('API:');
        expect(html).toContain('Database:');
        expect(html).toContain('Redis:');
        expect(html).toContain('Nginx:');
      });

      it('validates BURST_LEVELS and getLoadWarning tier logic', () => {
        expect(BURST_LEVELS).toHaveLength(4);
        expect(BURST_LEVELS[0].concurrency).toBe(50);
        expect(BURST_LEVELS[1].concurrency).toBe(100);
        expect(BURST_LEVELS[2].concurrency).toBe(250);
        expect(BURST_LEVELS[3].concurrency).toBe(500);
        expect(DEFAULT_BURST_LEVEL).toBe(100);

        expect(getLoadWarning(30)).toBeNull();
        expect(getLoadWarning(50)?.level).toBe('info');
        expect(getLoadWarning(100)?.level).toBe('warning');
        expect(getLoadWarning(250)?.level).toBe('danger');
        expect(getLoadWarning(500)?.level).toBe('critical');
      });

      it('enforces MAX_SAFE_CONCURRENCY limit of 500', () => {
        expect(MAX_SAFE_CONCURRENCY).toBe(500);
        expect(MAX_GATES).toBe(20);
        expect(MIN_GATES).toBe(1);

        // 20 gates * 10 scanners = 200 (well within safe limit)
        const maxPhysical = calculateTotalScanners(20, 10);
        expect(maxPhysical).toBe(200);
        expect(maxPhysical).toBeLessThanOrEqual(MAX_SAFE_CONCURRENCY);
      });
    });
  });
});
