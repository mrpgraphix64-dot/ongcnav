/// <reference types="jest" />
import {
  shouldProcessScan,
  DUPLICATE_DECODE_SUPPRESS_MS,
  SUCCESS_BANNER_DURATION_MS,
  selectBestCamera,
  formatCameraError,
  ensureVideoStreaming,
  validateCameraVideoFeed,
  getScannerStatusInstruction,
  safeStopScannerInstance,
} from './scanner-utils';

describe('Scanner Camera/API Duplicate Prevention (shouldProcessScan)', () => {
  it('ensures duplicate decode suppression window exceeds the success banner duration to avoid boundary races', () => {
    // DUPLICATE_DECODE_SUPPRESS_MS (4500ms) > SUCCESS_BANNER_DURATION_MS (3000ms)
    expect(DUPLICATE_DECODE_SUPPRESS_MS).toBeGreaterThan(SUCCESS_BANNER_DURATION_MS);
  });

  it('allows the very first decoded token through', () => {
    const res = shouldProcessScan(null, 'ticket-token-123', 1000);
    expect(res).toBe(true);
  });

  it('suppresses duplicate scan of the exact same token within the suppression window (e.g. at 1500ms and 3500ms)', () => {
    const lastDecode = { text: 'ticket-token-123', at: 1000 };
    // 500ms later, same token held in frame
    expect(shouldProcessScan(lastDecode, 'ticket-token-123', 1500, DUPLICATE_DECODE_SUPPRESS_MS)).toBe(false);
    // 2500ms later, same token held in frame right around previous banner reset
    expect(shouldProcessScan(lastDecode, 'ticket-token-123', 3500, DUPLICATE_DECODE_SUPPRESS_MS)).toBe(false);
  });

  it('allows the same token through after the suppression window has elapsed (e.g. 5600ms)', () => {
    const lastDecode = { text: 'ticket-token-123', at: 1000 };
    // 4600ms later (suppressMs is 4500ms)
    const res = shouldProcessScan(lastDecode, 'ticket-token-123', 5600, DUPLICATE_DECODE_SUPPRESS_MS);
    expect(res).toBe(true);
  });

  it('allows a different token through immediately, even within milliseconds (next person in line)', () => {
    const lastDecode = { text: 'ticket-token-123', at: 1000 };
    // 100ms later, next attendee steps up with new token
    const res = shouldProcessScan(lastDecode, 'ticket-token-456', 1100, DUPLICATE_DECODE_SUPPRESS_MS);
    expect(res).toBe(true);
  });

  it('rejects empty or whitespace-only decoded tokens', () => {
    expect(shouldProcessScan(null, '', 1000)).toBe(false);
    expect(shouldProcessScan(null, '   ', 1000)).toBe(false);
  });
});

describe('Scanner Camera Selection (selectBestCamera)', () => {
  it('returns environment facingMode constraint when devices list is empty', () => {
    expect(selectBestCamera([])).toEqual({ facingMode: 'environment' });
  });

  it('selects the back/rear camera when multiple cameras exist (typical Android multi-camera setup)', () => {
    const devices = [
      { id: 'cam-front', label: 'camera2 1, facing front' },
      { id: 'cam-back-main', label: 'camera2 0, facing back' },
      { id: 'cam-back-wide', label: 'camera2 2, facing back wide' },
    ];
    expect(selectBestCamera(devices)).toBe('cam-back-main');
  });

  it('selects camera matching environment label', () => {
    const devices = [
      { id: 'cam-1', label: 'Front Camera' },
      { id: 'cam-2', label: 'Rear Environment Camera' },
    ];
    expect(selectBestCamera(devices)).toBe('cam-2');
  });

  it('falls back to the first available camera if no labels indicate back/rear', () => {
    const devices = [
      { id: 'cam-default', label: 'Integrated Webcam' },
      { id: 'cam-other', label: 'USB Video Device' },
    ];
    expect(selectBestCamera(devices)).toBe('cam-default');
  });

  it('safely falls back to environment facingMode when all camera labels are empty strings', () => {
    const devicesWithEmptyLabels = [
      { id: 'cam-0', label: '' },
      { id: 'cam-1', label: '   ' },
    ];
    expect(selectBestCamera(devicesWithEmptyLabels)).toEqual({ facingMode: 'environment' });
  });
});

describe('Scanner Video Streaming Verification (ensureVideoStreaming)', () => {
  it('resolves true immediately when video is already playing with non-zero dimensions', async () => {
    const mockVideo = {
      readyState: 4,
      videoWidth: 1280,
      videoHeight: 720,
      paused: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as HTMLVideoElement;

    const result = await ensureVideoStreaming(mockVideo, 500);
    expect(result).toBe(true);
  });

  it('resolves false on timeout when readyState >= 2 but dimensions remain 0 (black screen guard)', async () => {
    const mockVideo = {
      readyState: 2,
      videoWidth: 0,
      videoHeight: 0,
      paused: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as HTMLVideoElement;

    const result = await ensureVideoStreaming(mockVideo, 50);
    expect(result).toBe(false);
  });

  it('resolves true when playing event fires with positive width and height', async () => {
    const listeners: Record<string, () => void> = {};
    const mockVideo = {
      readyState: 0,
      videoWidth: 0,
      videoHeight: 0,
      paused: true,
      addEventListener: jest.fn((event: string, cb: () => void) => {
        listeners[event] = cb;
      }),
      removeEventListener: jest.fn(),
    } as unknown as HTMLVideoElement;

    const streamPromise = ensureVideoStreaming(mockVideo, 1000);

    // Simulate video start
    (mockVideo as any).videoWidth = 640;
    (mockVideo as any).videoHeight = 480;
    if (listeners['playing']) {
      listeners['playing']();
    }

    const result = await streamPromise;
    expect(result).toBe(true);
  });
});

describe('Scanner Camera Error Formatting (formatCameraError)', () => {
  it('formats NotAllowedError as permission denied message', () => {
    const msg = formatCameraError({ name: 'NotAllowedError', message: 'Permission denied' });
    expect(msg).toContain('Camera permission denied');
    expect(msg).toContain('browser site settings');
  });

  it('formats NotFoundError as no camera message', () => {
    const msg = formatCameraError({ name: 'NotFoundError', message: 'Requested device not found' });
    expect(msg).toContain('No camera found on this device');
  });

  it('formats NotReadableError as in-use / hardware message', () => {
    const msg = formatCameraError({ name: 'NotReadableError', message: 'Could not start video source' });
    expect(msg).toContain('in use by another app');
  });

  it('formats OverconstrainedError properly', () => {
    const msg = formatCameraError({ name: 'OverconstrainedError', message: 'Constraint not satisfied' });
    expect(msg).toContain('does not support requested settings');
  });

  it('falls back to error message or default message for unexpected errors', () => {
    const msg = formatCameraError({ message: 'Custom hardware failure' });
    expect(msg).toContain('Custom hardware failure');

    const defaultMsg = formatCameraError(null);
    expect(defaultMsg).toContain('Could not access the camera');
  });
});

describe('Scanner Camera Feed Validation (validateCameraVideoFeed)', () => {
  it('returns ok: false when video element is null or undefined', () => {
    expect(validateCameraVideoFeed(null).ok).toBe(false);
    expect(validateCameraVideoFeed(undefined).ok).toBe(false);
  });

  it('returns ok: false when video element has zero width or height (empty canvas/black screen)', () => {
    const mockZeroDimensions = {
      videoWidth: 0,
      videoHeight: 0,
    } as HTMLVideoElement;
    const res = validateCameraVideoFeed(mockZeroDimensions);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('zero dimensions');
  });

  it('returns ok: true when video has active non-zero dimensions', () => {
    const mockActive = {
      videoWidth: 1280,
      videoHeight: 720,
    } as HTMLVideoElement;
    const res = validateCameraVideoFeed(mockActive);
    expect(res.ok).toBe(true);
  });
});

describe('Scanner Status Instruction Guarantees (getScannerStatusInstruction)', () => {
  it('never shows "Ready for scan" when cameraError is true', () => {
    const msg = getScannerStatusInstruction({
      cameraReady: false,
      cameraError: true,
      scanState: 'scanning',
    });
    expect(msg).toBe('Camera unavailable. Use manual ticket entry below.');
  });

  it('shows "Starting camera…" when cameraReady is false and no error', () => {
    const msg = getScannerStatusInstruction({
      cameraReady: false,
      cameraError: false,
      scanState: 'idle',
    });
    expect(msg).toBe('Starting camera… Align QR code once preview appears.');
  });

  it('prevents "Ready for scan" when cameraReady is false even if scanState is scanning', () => {
    const msg = getScannerStatusInstruction({
      cameraReady: false,
      cameraError: false,
      scanState: 'scanning',
    });
    expect(msg).toBe('Starting camera… Align QR code once preview appears.');
  });

  it('shows "Ready for scan" only when cameraReady is true, no error, and scanState is scanning', () => {
    const msg = getScannerStatusInstruction({
      cameraReady: true,
      cameraError: false,
      scanState: 'scanning',
    });
    expect(msg).toBe('Ready for scan. Align QR code in camera view.');
  });

  it('shows default idle text when cameraReady is true but scanState is idle', () => {
    const msg = getScannerStatusInstruction({
      cameraReady: true,
      cameraError: false,
      scanState: 'idle',
    });
    expect(msg).toBe('Scan results will appear here instantly.');
  });
});

describe('Safe Scanner Stopping and Cleanup (safeStopScannerInstance)', () => {
  it('safely handles null or undefined instance without error', async () => {
    await expect(safeStopScannerInstance(null)).resolves.not.toThrow();
  });

  it('does nothing if instance is currently in-flight starting', async () => {
    const mockInstance = {
      isScanning: true,
      stop: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn(),
    };
    await safeStopScannerInstance(mockInstance, true);
    expect(mockInstance.stop).not.toHaveBeenCalled();
    expect(mockInstance.clear).not.toHaveBeenCalled();
  });

  it('stops and clears an active scanning instance', async () => {
    const mockInstance = {
      isScanning: true,
      stop: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn(),
    };
    await safeStopScannerInstance(mockInstance, false);
    expect(mockInstance.stop).toHaveBeenCalledTimes(1);
    expect(mockInstance.clear).toHaveBeenCalledTimes(1);
  });

  it('only clears instance if not actively scanning', async () => {
    const mockInstance = {
      isScanning: false,
      stop: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn(),
    };
    await safeStopScannerInstance(mockInstance, false);
    expect(mockInstance.stop).not.toHaveBeenCalled();
    expect(mockInstance.clear).toHaveBeenCalledTimes(1);
  });

  it('safely swallows rejection from stop() and attempts clear()', async () => {
    const mockInstance = {
      isScanning: true,
      stop: jest.fn().mockRejectedValue(new Error('Html5Qrcode scanner is not running')),
      clear: jest.fn(),
    };
    await expect(safeStopScannerInstance(mockInstance, false)).resolves.not.toThrow();
    expect(mockInstance.clear).toHaveBeenCalledTimes(1);
  });
});
