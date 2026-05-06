import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET() {
  const authenticated = await readSessionFromCookies();
  return NextResponse.json({ authenticated });
}
