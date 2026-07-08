/**
 * ============================
 * 同步伺服器 API 客戶端
 * ============================
 * serverUrl 為空字串代表同源（正式部署時前端由後端一起服務）。
 */

export interface AuthState {
  serverUrl: string;
  token: string;
  email: string;
}

const AUTH_KEY = 'tp-auth';

export function getAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

export function setAuth(auth: AuthState): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}

async function request<T>(
  serverUrl: string,
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `伺服器錯誤 (${res.status})`);
  return body;
}

export interface AuthResponse {
  token: string;
  email: string;
}

export function register(serverUrl: string, email: string, password: string) {
  return request<AuthResponse>(serverUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function login(serverUrl: string, email: string, password: string) {
  return request<AuthResponse>(serverUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export interface SyncDownload {
  data: unknown | null;
  updatedAt: string | null;
}

export function getSync(auth: AuthState) {
  return request<SyncDownload>(auth.serverUrl, '/api/sync', {}, auth.token);
}

export function putSync(auth: AuthState, data: unknown) {
  return request<{ updatedAt: string }>(
    auth.serverUrl,
    '/api/sync',
    { method: 'PUT', body: JSON.stringify({ data }) },
    auth.token,
  );
}
