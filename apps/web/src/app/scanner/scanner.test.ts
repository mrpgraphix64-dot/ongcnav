/// <reference types="jest" />
import { shouldProcessScan, DUPLICATE_DECODE_SUPPRESS_MS } from './page';

describe('Scanner Camera/API Duplicate Prevention (shouldProcessScan)', () => {
  it('allows the very first decoded token through', () => {
    const res = shouldProcessScan(null, 'ticket-token-123', 1000);
    expect(res).toBe(true);
  });

  it('suppresses duplicate scan of the exact same token within the suppression window (e.g. 3000ms)', () => {
    const lastDecode = { text: 'ticket-token-123', at: 1000 };
    // 500ms later, same token held in frame
    const res = shouldProcessScan(lastDecode, 'ticket-token-123', 1500, DUPLICATE_DECODE_SUPPRESS_MS);
    expect(res).toBe(false);
  });

  it('allows the same token through after the suppression window has elapsed', () => {
    const lastDecode = { text: 'ticket-token-123', at: 1000 };
    // 3001ms later
    const res = shouldProcessScan(lastDecode, 'ticket-token-123', 4001, DUPLICATE_DECODE_SUPPRESS_MS);
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
