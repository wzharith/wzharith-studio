import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'studio_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET is not set or too short. Add a long random string to platform/.env.local.'
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: 'studio';
  iat: number;
  exp: number;
}

export async function signSession(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .setSubject('studio')
    .sign(getSessionSecret());
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return payload?.sub === 'studio';
  } catch {
    return false;
  }
}

export async function readSessionFromCookies(): Promise<boolean> {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySession(cookie);
}

export async function requireAuth(): Promise<void> {
  const ok = await readSessionFromCookies();
  if (!ok) {
    const err = new Error('Unauthorized');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
}

/**
 * Helper for route handlers — returns a 401 NextResponse when not authed,
 * or null when ok. Use as: `const unauth = await requireAuthRoute(); if (unauth) return unauth;`
 */
export async function requireAuthRoute() {
  const { NextResponse } = await import('next/server');
  const ok = await readSessionFromCookies();
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function checkPassword(submitted: string): boolean {
  const expected = process.env.INVOICE_PASSWORD;
  if (!expected) return false;
  if (submitted.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ submitted.charCodeAt(i);
  }
  return result === 0;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
