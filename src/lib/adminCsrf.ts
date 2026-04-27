const ADMIN_CSRF_COOKIE_NAME = 'admin_csrf_token';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split('; ') : [];

  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split('=');

    if (rawName === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

export function getAdminCsrfToken(): string | null {
  return readCookie(ADMIN_CSRF_COOKIE_NAME);
}

export async function ensureAdminCsrfToken(): Promise<string> {
  const existingToken = getAdminCsrfToken();

  if (existingToken) {
    return existingToken;
  }

  const response = await fetch('/api/admin/auth/csrf', {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Impossible d’initialiser la protection CSRF.');
  }

  const token = getAdminCsrfToken();

  if (!token) {
    throw new Error('Jeton CSRF introuvable après initialisation.');
  }

  return token;
}

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method ?? 'GET').toUpperCase();

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return fetch(input, {
      ...init,
      credentials: init.credentials ?? 'include',
    });
  }

  const csrfToken = await ensureAdminCsrfToken();
  const headers = new Headers(init.headers ?? {});

  headers.set('X-CSRF-Token', csrfToken);

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });
}