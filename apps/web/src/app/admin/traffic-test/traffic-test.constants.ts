export const MIN_SIMULATED_USERS = 10;
export const MAX_SIMULATED_USERS = 500;
export const USER_SCALE_MARKS = [10, 100, 250, 500];

export function calculateSliderPosition(value: number): number {
  return ((value - MIN_SIMULATED_USERS) / (MAX_SIMULATED_USERS - MIN_SIMULATED_USERS)) * 100;
}

export const MIN_GATES = 1;
export const MAX_GATES = 3;
export const DEFAULT_GATES = 3;

export const MIN_SCANNERS_PER_GATE = 1;
export const MAX_SCANNERS_PER_GATE = 10;
export const DEFAULT_SCANNERS_PER_GATE = 2;

export const MIN_SCAN_INTERVAL = 1;
export const MAX_SCAN_INTERVAL = 60;
export const DEFAULT_SCAN_INTERVAL = 2;

export const MIN_DURATION_SECONDS = 5;
export const MAX_DURATION_SECONDS = 300;
export const DEFAULT_DURATION_SECONDS = 30;

export function calculateEstimatedCycles(durationSeconds: number, scanIntervalSeconds: number): number {
  const safeDuration = Math.max(MIN_DURATION_SECONDS, Math.min(MAX_DURATION_SECONDS, Math.floor(durationSeconds) || MIN_DURATION_SECONDS));
  const safeInterval = Math.max(MIN_SCAN_INTERVAL, Math.min(MAX_SCAN_INTERVAL, Math.floor(scanIntervalSeconds) || MIN_SCAN_INTERVAL));
  return Math.floor(safeDuration / safeInterval);
}

export function calculateBaseScanActions(totalScanners: number, durationSeconds: number, scanIntervalSeconds: number): number {
  const cycles = calculateEstimatedCycles(durationSeconds, scanIntervalSeconds);
  return totalScanners * cycles;
}

export function calculateEstimatedRequests(
  arg1: string | number,
  arg2: number,
  arg3: number,
  arg4?: number,
): number {
  let scenario = 'NORMAL';
  let totalScanners: number;
  let durationSeconds: number;
  let scanIntervalSeconds: number;

  if (typeof arg1 === 'string') {
    scenario = arg1;
    totalScanners = arg2;
    durationSeconds = arg3;
    scanIntervalSeconds = arg4 ?? DEFAULT_SCAN_INTERVAL;
  } else {
    totalScanners = arg1;
    durationSeconds = arg2;
    scanIntervalSeconds = arg3;
  }

  const baseActions = calculateBaseScanActions(totalScanners, durationSeconds, scanIntervalSeconds);

  if (scenario === 'DUPLICATE') {
    return baseActions * 2;
  }
  if (scenario === 'MIXED') {
    // 70% normal (1 req), 20% duplicate (2 reqs), 10% invalid (1 req) -> 0.7*1 + 0.2*2 + 0.1*1 = 1.2 reqs/action
    return Math.round(baseActions * 1.2);
  }

  return baseActions;
}

export function calculateTotalScanners(numberOfGates: number, scannersPerGate: number): number {
  const safeGates = Math.max(MIN_GATES, Math.min(MAX_GATES, Math.floor(numberOfGates) || MIN_GATES));
  const safeScanners = Math.max(MIN_SCANNERS_PER_GATE, Math.min(MAX_SCANNERS_PER_GATE, Math.floor(scannersPerGate) || MIN_SCANNERS_PER_GATE));
  return safeGates * safeScanners;
}

export function calculateExpectedScanRate(totalScanners: number, scanIntervalSeconds: number): string {
  const safeInterval = Math.max(MIN_SCAN_INTERVAL, Math.min(MAX_SCAN_INTERVAL, scanIntervalSeconds || MIN_SCAN_INTERVAL));
  const rate = totalScanners / safeInterval;
  const formatted = Number.isInteger(rate) ? rate.toString() : rate.toFixed(1);
  return `~${formatted} scans/sec`;
}

export function buildInitialRunTelemetry(
  runId: string,
  params: {
    status?: string;
    scenario: string;
    mode: string;
    simulatedUsers: number;
  },
) {
  return {
    id: runId,
    status: params.status || 'RUNNING',
    scenario: params.scenario,
    mode: params.mode,
    simulatedUsers: params.simulatedUsers,
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
}
