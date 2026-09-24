const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  // If not FormData, default to application/json
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      (data && (data.message || data.error)) ||
      `Request failed with status ${response.status}`;
    throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
  }

  // The NestJS backend's global TransformInterceptor wraps most responses as
  // { success: true, data: <payload> }. Every caller here expects the
  // payload itself, so unwrap it once, in this one place, rather than
  // requiring every caller to know about and reach into `.data`. Responses
  // that already carry their own shape without a nested `data` key (e.g.
  // { success: true, message: '...' }) are passed through unchanged.
  if (
    data &&
    typeof data === 'object' &&
    'success' in data &&
    'data' in data
  ) {
    return data.data;
  }

  return data;
}

export { API_BASE_URL };
