export const API_URL = `${import.meta.env.VITE_WEB_API_URL ?? ''}/api`;
export const SERVER_URL = `${import.meta.env.VITE_WEB_API_URL ?? ''}`;

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

// Reads the server's `{ error }` / `{ message }` body when present, so
// callers can show the real failure reason instead of a generic message.
export async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.clone().json();
    if (typeof body?.error === 'string') return body.error;
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // Response wasn't JSON (e.g. an HTML error/challenge page) - fall through.
  }
  return `Request failed (${response.status} ${response.statusText})`;
}

export async function fetchFromAPI<T>(
  endpoint: string,
  method: string = 'GET',
  body: Record<string, unknown> | null = null
) {
  let searchParams: string = '';

  if (method === 'GET' && body) {
    let tempSearchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      tempSearchParams.set(key, String(value));
    }

    searchParams = `?${tempSearchParams.toString()}`;
  }

  const response = await fetch(`${API_URL}/${endpoint}${searchParams}`, {
    method,
    credentials: 'include',
    body: method !== 'GET' && body ? JSON.stringify(body) : null,
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status === 401) {
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response.json() as Promise<T>;
}
