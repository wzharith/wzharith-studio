import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { configKv } from '@/db/schema';
import { requireAuthRoute } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function inferType(value: unknown): string {
  if (typeof value === 'object' && value !== null) return 'json';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

export async function GET() {
  try {
    const rows = await db.select().from(configKv);
    const config: Record<string, unknown> = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error('[/api/config GET]', err);
    return NextResponse.json(
      { success: false, config: {}, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  let body: { data?: Record<string, unknown> } | Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const data: Record<string, unknown> | undefined =
    body && typeof body === 'object' && 'data' in body
      ? (body as { data?: Record<string, unknown> }).data
      : (body as Record<string, unknown>);

  if (!data || typeof data !== 'object') {
    return NextResponse.json({ success: false, error: 'Missing config payload' }, { status: 400 });
  }

  try {
    for (const [key, value] of Object.entries(data)) {
      const type = inferType(value);
      await db
        .insert(configKv)
        .values({
          key,
          value: value as never,
          type,
        })
        .onConflictDoUpdate({
          target: configKv.key,
          set: { value: value as never, type, updatedAt: sql`now()` },
        });
    }
    return NextResponse.json({ success: true, count: Object.keys(data).length });
  } catch (err) {
    console.error('[/api/config POST]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
