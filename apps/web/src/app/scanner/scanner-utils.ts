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
