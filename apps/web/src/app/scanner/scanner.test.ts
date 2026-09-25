/// <reference types="jest" />
import {
  shouldProcessScan,
  DUPLICATE_DECODE_SUPPRESS_MS,
  SUCCESS_BANNER_DURATION_MS,
} from './page';

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
