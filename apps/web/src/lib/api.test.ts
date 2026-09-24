/// <reference types="jest" />
// tsconfig.json sets "types": [] app-wide (a deliberate choice made
// elsewhere, not something to change here), so Jest's ambient globals
// (describe/it/expect/jest) need this file-scoped reference instead of
// relying on automatic @types inclusion.
import { fetchApi } from './api';

function mockFetchOnce(status: number, body: any) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('fetchApi response envelope handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('A: unwraps { success: true, data: {...} } to the payload', async () => {
    mockFetchOnce(200, { success: true, data: { totalAttendees: 42 } });

    const result = await fetchApi('/admin/dashboard/live-stats');

    expect(result).toEqual({ totalAttendees: 42 });
  });

  it('B: returns { success: true, message: "..." } unchanged (no nested data key)', async () => {
    mockFetchOnce(200, { success: true, message: 'Logged out successfully.' });

    const result = await fetchApi('/auth/logout', { method: 'POST' });

    expect(result).toEqual({ success: true, message: 'Logged out successfully.' });
  });

  it('C: returns a plain, non-enveloped JSON response unchanged', async () => {
    mockFetchOnce(200, { activeDate: '2026-10-11', eventStatus: 'open' });

    const result = await fetchApi('/event-control/status');

    expect(result).toEqual({ activeDate: '2026-10-11', eventStatus: 'open' });
  });

  it('D: still throws on a non-2xx response, using the error message from the body', async () => {
    mockFetchOnce(401, { success: false, message: 'Invalid credentials.' });

    await expect(fetchApi('/auth/login', { method: 'POST' })).rejects.toThrow(
      'Invalid credentials.',
    );
  });

  it('D: throws a generic message when the error body has no message/error field', async () => {
    mockFetchOnce(500, null);

    await expect(fetchApi('/admin/dashboard/live-stats')).rejects.toThrow(
      'Request failed with status 500',
    );
  });
});
