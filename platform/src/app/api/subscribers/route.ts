import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { subscribers } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const phone = String(body?.phone ?? '').trim();
  if (!phone) {
    return NextResponse.json({ success: false, error: 'Phone is required' }, { status: 400 });
  }

  try {
    await db.insert(subscribers).values({ phone }).onConflictDoNothing({ target: subscribers.phone });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[/api/subscribers POST]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
