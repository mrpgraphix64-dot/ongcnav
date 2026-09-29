export const MIN_SIMULATED_USERS = 10;
export const MAX_SIMULATED_USERS = 500;
export const USER_SCALE_MARKS = [10, 100, 250, 500];

export function calculateSliderPosition(value: number): number {
  return ((value - MIN_SIMULATED_USERS) / (MAX_SIMULATED_USERS - MIN_SIMULATED_USERS)) * 100;
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
