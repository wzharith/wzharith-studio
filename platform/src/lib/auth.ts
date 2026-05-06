/**
 * Client-side authentication helpers for WZHarith Studio.
 *
 * Auth is server-side: the password lives only in INVOICE_PASSWORD on the
 * server. Login posts to /api/auth/login which sets a signed httpOnly cookie
 * (studio_session). Subsequent /api/* calls automatically include the cookie.
 *
 * sessionStorage holds an optimistic "logged in" flag so the UI doesn't flash
 * a login form on every navigation; the server cookie is the source of truth.
 */

const AUTH_FLAG_KEY = 'studio_auth';

function setLocalFlag(value: boolean): void {
  if (typeof window === 'undefined') return;
  if (value) {
    sessionStorage.setItem(AUTH_FLAG_KEY, 'true');
  } else {
    sessionStorage.removeItem(AUTH_FLAG_KEY);
  }
}

/**
 * Optimistic, synchronous check based on sessionStorage. Use as the initial
 * gate; pair with `verifyAuthWithServer()` on mount to confirm.
 */
export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(AUTH_FLAG_KEY) === 'true';
};

/**
 * Confirm the session cookie is still valid on the server. Updates the
 * sessionStorage flag and returns the authoritative value.
 */
export const verifyAuthWithServer = async (): Promise<boolean> => {
  try {
    const res = await fetch('/api/auth/status', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) {
      setLocalFlag(false);
      return false;
    }
    const data = (await res.json()) as { authenticated?: boolean };
    const ok = !!data.authenticated;
    setLocalFlag(ok);
    return ok;
  } catch {
    return isAuthenticated();
  }
};

/**
 * Validate password with the server and, on success, set the session cookie
 * and the local optimistic flag. Async (was sync before the migration).
 */
export const login = async (password: string): Promise<boolean> => {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setLocalFlag(false);
      return false;
    }
    const data = (await res.json()) as { success?: boolean };
    const ok = !!data.success;
    setLocalFlag(ok);
    return ok;
  } catch {
    return false;
  }
};

/**
 * Clear server cookie and local flag.
 */
export const logout = async (): Promise<void> => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore network errors; still clear local
  }
  setLocalFlag(false);
};
