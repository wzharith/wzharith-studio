import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { configHistory } from '@/db/schema';
import { requireAuthRoute } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  try {
    const rows = await db.select().from(configHistory).orderBy(desc(configHistory.year));
    const history = rows.map((row) => ({
      year: row.year,
      packages: (row.snapshot?.packages ?? []) as unknown[],
      addons: (row.snapshot?.addons ?? []) as unknown[],
      businessInfo: (row.snapshot?.businessInfo ?? {}) as Record<string, unknown>,
      archivedAt: row.archivedAt instanceof Date ? row.archivedAt.toISOString() : String(row.archivedAt),
      notes: row.notes,
    }));
    return NextResponse.json({ success: true, history });
  } catch (err) {
    console.error('[/api/config/history]', err);
    return NextResponse.json(
      { success: false, history: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
