import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StartLoadTestDto } from './start-test.dto';
import { LoadTestMode, LoadTestScenario } from '@ongc/shared-types';

describe('StartLoadTestDto', () => {
  it('should validate all canonical scenarios and modes successfully', async () => {
    const validScenarios = [
      LoadTestScenario.NORMAL,
      LoadTestScenario.DUPLICATE,
      LoadTestScenario.INVALID_QR,
      LoadTestScenario.NOT_BOOKED,
      LoadTestScenario.PEAK_BURST,
      LoadTestScenario.MIXED,
    ];

    const validModes = [
      LoadTestMode.DRY_RUN,
      LoadTestMode.REAL_HTTP,
    ];

    for (const scenario of validScenarios) {
      for (const mode of validModes) {
        const dto = plainToInstance(StartLoadTestDto, {
          scenario,
          mode,
          simulatedUsers: 100,
          gateId: '1',
        });

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    }
  });

  it('should reject invalid scenario and ensure INVALID_QR is not duplicated in error message', async () => {
    const dto = plainToInstance(StartLoadTestDto, {
      scenario: 'INVALID_SCENARIO',
      mode: LoadTestMode.REAL_HTTP,
      simulatedUsers: 100,
      gateId: '1',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const scenarioError = errors.find((e) => e.property === 'scenario');
    expect(scenarioError).toBeDefined();

    const errorMsg = scenarioError?.constraints?.isEnum || '';
    expect(errorMsg).toContain('NORMAL, DUPLICATE, INVALID_QR, NOT_BOOKED, PEAK_BURST, MIXED');
    // Ensure INVALID_QR appears exactly once in the allowed values string
    const occurrences = (errorMsg.match(/INVALID_QR/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('should reject invalid execution mode', async () => {
    const dto = plainToInstance(StartLoadTestDto, {
      scenario: LoadTestScenario.PEAK_BURST,
      mode: 'real_http', // lowercase should be rejected
      simulatedUsers: 100,
      gateId: '1',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const modeError = errors.find((e) => e.property === 'mode');
    expect(modeError).toBeDefined();
    expect(modeError?.constraints?.isEnum).toContain('DRY_RUN, REAL_HTTP');
  });

  it('should validate simulated users bounds (1 to 500)', async () => {
    const invalidDto = plainToInstance(StartLoadTestDto, {
      scenario: LoadTestScenario.NORMAL,
      mode: LoadTestMode.REAL_HTTP,
      simulatedUsers: 0,
      gateId: '1',
    });
    const errors = await validate(invalidDto);
    expect(errors.find((e) => e.property === 'simulatedUsers')).toBeDefined();

    const maxValidDto = plainToInstance(StartLoadTestDto, {
      scenario: LoadTestScenario.NORMAL,
      mode: LoadTestMode.REAL_HTTP,
      simulatedUsers: 500,
      gateId: '1',
    });
    const errorsMax = await validate(maxValidDto);
    expect(errorsMax.find((e) => e.property === 'simulatedUsers')).toBeUndefined();

    const tooHighDto = plainToInstance(StartLoadTestDto, {
      scenario: LoadTestScenario.NORMAL,
      mode: LoadTestMode.REAL_HTTP,
      simulatedUsers: 501,
      gateId: '1',
    });
    const errorsHigh = await validate(tooHighDto);
    expect(errorsHigh.find((e) => e.property === 'simulatedUsers')).toBeDefined();
  });

  it('should validate scanIntervalSeconds bounds (1 to 60) and durationSeconds bounds (5 to 300)', async () => {
    // Valid values
    const validDto = plainToInstance(StartLoadTestDto, {
      scenario: LoadTestScenario.NORMAL,
      mode: LoadTestMode.REAL_HTTP,
      simulatedUsers: 6,
      scanIntervalSeconds: 2,
      durationSeconds: 30,
      gateId: '1',
    });
    const validErrors = await validate(validDto);
    expect(validErrors).toHaveLength(0);

    // Below minimums
    const belowMinDto = plainToInstance(StartLoadTestDto, {
      scenario: LoadTestScenario.NORMAL,
      mode: LoadTestMode.REAL_HTTP,
      simulatedUsers: 6,
      scanIntervalSeconds: 0,
      durationSeconds: 2,
      gateId: '1',
    });
    const belowMinErrors = await validate(belowMinDto);
    expect(belowMinErrors.find((e) => e.property === 'scanIntervalSeconds')).toBeDefined();
    expect(belowMinErrors.find((e) => e.property === 'durationSeconds')).toBeDefined();

    // Above maximums
    const aboveMaxDto = plainToInstance(StartLoadTestDto, {
      scenario: LoadTestScenario.NORMAL,
      mode: LoadTestMode.REAL_HTTP,
      simulatedUsers: 6,
      scanIntervalSeconds: 70,
      durationSeconds: 400,
      gateId: '1',
    });
    const aboveMaxErrors = await validate(aboveMaxDto);
    expect(aboveMaxErrors.find((e) => e.property === 'scanIntervalSeconds')).toBeDefined();
    expect(aboveMaxErrors.find((e) => e.property === 'durationSeconds')).toBeDefined();
  });
});
