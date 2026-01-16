/**
 * Unified Authentication for WZHarith Studio
 *
 * Shared auth state across invoice, admin, and dashboard pages.
 * Login once = access all protected pages.
 */

// Session storage key for auth state
const AUTH_KEY = 'studio_auth';

// Password from environment variable
const STUDIO_PASSWORD = process.env.NEXT_PUBLIC_INVOICE_PASSWORD || 'taktahu';

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(AUTH_KEY) === 'true';
};

/**
 * Validate password and set auth state
 */
export const login = (password: string): boolean => {
  if (password === STUDIO_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    return true;
  }
  return false;
};

/**
 * Clear auth state (logout)
 */
export const logout = (): void => {
  sessionStorage.removeItem(AUTH_KEY);
};

/**
 * Get the expected password (for debugging only - remove in production)
 */
export const getPasswordHint = (): string => {
  // Return first letter + length for hint
  if (!STUDIO_PASSWORD) return 'not set';
  return `${STUDIO_PASSWORD[0]}${'*'.repeat(STUDIO_PASSWORD.length - 1)}`;
};
