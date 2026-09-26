export const DUPLICATE_DECODE_SUPPRESS_MS = 4500;
export const SUCCESS_BANNER_DURATION_MS = 3000;
export const ERROR_BANNER_DURATION_MS = 4000;

export function shouldProcessScan(
  lastDecode: { text: string; at: number } | null,
  newText: string,
  now: number = Date.now(),
  suppressMs: number = DUPLICATE_DECODE_SUPPRESS_MS,
): boolean {
  if (!newText || !newText.trim()) return false;
  if (!lastDecode) return true;
  if (lastDecode.text === newText.trim() && now - lastDecode.at < suppressMs) {
    return false;
  }
  return true;
}

export function formatCameraError(err: any): string {
  if (!err) {
    return 'Could not access the camera. Check permissions or use manual entry below.';
  }
  const name = err.name || '';
  const msg = err.message || (typeof err === 'string' ? err : '');

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    /permission|denied/i.test(msg)
  ) {
    return 'Camera permission denied. Please allow camera access in browser site settings and retry.';
  }

  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    /not\s*found|no\s*device/i.test(msg)
  ) {
    return 'No camera found on this device. Please use manual ticket entry below.';
  }

  if (
    name === 'NotReadableError' ||
    name === 'TrackStartError' ||
    /in\s*use|busy|could\s*not\s*start/i.test(msg)
  ) {
    return 'Camera is in use by another app or browser tab. Please close other camera apps and retry.';
  }

  if (name === 'OverconstrainedError' || /overconstrained/i.test(msg)) {
    return 'Camera does not support requested settings. Tap Retry to use default settings.';
  }

  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'Camera requires HTTPS. Please connect via a secure HTTPS connection.';
  }

  return msg || 'Could not access the camera. Check permissions or use manual entry below.';
}

export function selectBestCamera(
  devices: Array<{ id: string; label: string }>
): string | { facingMode: string } {
  if (!devices || devices.length === 0) {
    return { facingMode: 'environment' };
  }
  const backCam = devices.find((d) =>
    /back|rear|environment|facing\s*back/i.test(d.label)
  );
  if (backCam) {
    return backCam.id;
  }
  // If labels are masked or empty (e.g. before permissions or privacy restrictions),
  // avoid blindly selecting devices[0] which is often the front camera on Android.
  // Instead, delegate to browser's native facingMode constraint.
  const hasAnyLabels = devices.some(
    (d) => typeof d.label === 'string' && d.label.trim().length > 0
  );
  if (!hasAnyLabels) {
    return { facingMode: 'environment' };
  }
  return devices[0].id;
}

export function ensureVideoStreaming(
  video: HTMLVideoElement,
  timeoutMs = 3500
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!video) return resolve(false);

    // If video is already actively playing and has valid dimensions
    if (
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      !video.paused
    ) {
      return resolve(true);
    }

    let settled = false;
    const cleanup = () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('loadeddata', onPlaying);
      video.removeEventListener('canplay', onPlaying);
      clearTimeout(timer);
    };

    const done = (result: boolean) => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(result);
      }
    };

    const onPlaying = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        done(true);
      }
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('loadeddata', onPlaying);
    video.addEventListener('canplay', onPlaying);

    const timer = setTimeout(() => {
      // Require actual non-zero video dimensions; do NOT treat readyState alone as success
      done(video.videoWidth > 0 && video.videoHeight > 0);
    }, timeoutMs);
  });
}

/**
 * Validates that a video element is genuinely attached and streaming frames.
 * Returns true only when the element exists, is not paused, and has non-zero dimensions.
 */
export function validateCameraVideoFeed(
  video: HTMLVideoElement | null | undefined
): { ok: boolean; reason?: string } {
  if (!video) {
    return { ok: false, reason: 'No video element attached to preview container.' };
  }
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    return { ok: false, reason: 'Video element has zero dimensions (no active frames).' };
  }
  return { ok: true };
}

/**
 * Computes the correct scanner status message for the UI.
 * GUARANTEE: Never returns "Ready for scan" when the camera is not genuinely ready or has an error.
 */
export function getScannerStatusInstruction(params: {
  cameraReady: boolean;
  cameraError: boolean;
  scanState: string;
}): string {
  const { cameraReady, cameraError, scanState } = params;

  if (cameraError) {
    return 'Camera unavailable. Use manual ticket entry below.';
  }
  if (!cameraReady) {
    return 'Starting camera… Align QR code once preview appears.';
  }
  if (scanState === 'scanning') {
    return 'Ready for scan. Align QR code in camera view.';
  }
  return 'Scan results will appear here instantly.';
}

/**
 * Safely stops and clears an Html5Qrcode instance during unmount or retry,
 * avoiding uncaught promise rejections if the scanner is not currently scanning.
 */
export async function safeStopScannerInstance(
  instance: { isScanning?: boolean; stop: () => Promise<void>; clear: () => void } | null,
  isStarting = false
): Promise<void> {
  if (!instance || isStarting) return;
  try {
    if (instance.isScanning) {
      await instance.stop();
    }
    instance.clear();
  } catch {
    try {
      instance.clear();
    } catch {}
  }
}

export const SCANNER_OFFICIAL_TEST_DATES = [
  { value: '2026-10-11', label: '11 Oct 2026' },
  { value: '2026-10-12', label: '12 Oct 2026' },
  { value: '2026-10-13', label: '13 Oct 2026' },
  { value: '2026-10-14', label: '14 Oct 2026' },
  { value: '2026-10-15', label: '15 Oct 2026' },
  { value: '2026-10-16', label: '16 Oct 2026' },
  { value: '2026-10-17', label: '17 Oct 2026' },
  { value: '2026-10-18', label: '18 Oct 2026' },
  { value: '2026-10-19', label: '19 Oct 2026' },
] as const;

export function formatEventDateLabel(isoDate: string): string {
  const match = SCANNER_OFFICIAL_TEST_DATES.find((d) => d.value === isoDate);
  if (match) return match.label;
  try {
    const parts = isoDate.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
  } catch {}
  return isoDate;
}

export function isSystemDateDiffering(testDate: string, now: Date = new Date()): boolean {
  const systemIst = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return testDate !== systemIst;
}
