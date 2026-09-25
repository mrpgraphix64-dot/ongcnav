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
  // requiring every caller to know about and reach into `.data`. Some
  // service methods author that same { success, data } shape by hand with
  // an incidental `message` alongside it (e.g. registration.service.ts's
  // `{ success, message, data: result }`) — still safe to unwrap, since
  // `message` there is just a human-readable string, not a field callers
  // need from the top level.
  //
  // Responses that already carry their OWN richer shape — where `data` is
  // one domain field among other meaningful sibling fields the caller
  // reads directly (e.g. POST /scanner/checkin's
  // { success, result, message, statusCode, data }) — must be returned
  // completely unchanged. Unwrapping those would silently discard
  // `result`/`statusCode`/etc., which is exactly what happened here before
  // this fix. The rule: only unwrap when every key besides `success` and
  // `data` is (at most) `message`.
  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    'success' in data &&
    'data' in data &&
    Object.keys(data).every((key) => key === 'success' || key === 'data' || key === 'message')
  ) {
    return data.data;
  }

  return data;
}

export { API_BASE_URL };
