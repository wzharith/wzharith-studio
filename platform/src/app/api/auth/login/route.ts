import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  checkPassword,
  sessionCookieOptions,
  signSession,
} from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const password = String(body?.password ?? '');
  if (!password) {
    return NextResponse.json({ success: false, error: 'Password required' }, { status: 400 });
  }

  if (!checkPassword(password)) {
    return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
  }

  const token = await signSession();
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return res;
}
