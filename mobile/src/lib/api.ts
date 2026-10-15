import { GAME_URL } from './config';

/**
 * Calls the ShunyaScape API through the website (same origin as the game's
 * WebView). `X-Client: app` makes the auth endpoints return the session token
 * in the body, since the app can't read the site's cookies.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: object, token?: string): Promise<T> {
  const res = await fetch(`${GAME_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client': 'app',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(String(data.error ?? `Something went wrong (${res.status})`), res.status, data);
  return data as T;
}

interface SessionResponse {
  appToken?: string;
}

export const api = {
  login: (email: string, password: string) => call<SessionResponse>('/api/auth/login', { email, password }),
  register: (name: string, email: string, password: string) => call<{ requiresVerification: boolean }>('/api/auth/register', { name, email, password }),
  verifyOtp: (email: string, otp: string) => call<SessionResponse>('/api/auth/verify-otp', { email, otp }),
  google: (credential: string) => call<SessionResponse>('/api/auth/google', { credential }),
  forgotPassword: (email: string) => call<object>('/api/auth/forgot-password', { email }),
  resetPassword: (email: string, otp: string, newPassword: string) =>
    call<object>('/api/auth/reset-password', { email, otp, newPassword }),
  /** One-time code that logs the game's WebView into this session. */
  handoff: (token: string) => call<{ code: string }>('/api/auth/handoff', undefined, token),
  logout: (token: string) => call<object>('/api/auth/logout', undefined, token),
};
