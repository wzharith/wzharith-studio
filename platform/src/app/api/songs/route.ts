import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { songs } from '@/db/schema';
import { requireAuthRoute } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public read — repertoire for marketing site and invoice picker */
export async function GET() {
  try {
    const rows = await db
      .select()
      .from(songs)
      .where(eq(songs.isActive, true))
      .orderBy(asc(songs.sortOrder), asc(songs.title));
    return NextResponse.json({
      success: true,
      songs: rows.map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        category: r.category,
        language: r.language,
        popularity: r.popularity,
        mood: r.mood,
        recommended_for: r.recommendedFor,
      })),
    });
  } catch (err) {
    console.error('[/api/songs GET]', err);
    return NextResponse.json(
      { success: false, songs: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/** Bulk upsert — seed or admin sync from static data */
export async function POST(request: NextRequest) {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  let body: { songs?: Array<Record<string, unknown>> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const list = body.songs;
  if (!Array.isArray(list) || list.length === 0) {
    return NextResponse.json({ success: false, error: 'Expected { songs: [...] }' }, { status: 400 });
  }

  try {
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i] as {
        id: string;
        title: string;
        artist: string;
        category: string;
        language: string;
        popularity?: number;
        mood?: string[];
        recommended_for?: string[];
        sort_order?: number;
        is_active?: boolean;
      };
      if (!s.id || !s.title) continue;
      await db
        .insert(songs)
        .values({
          id: s.id,
          title: s.title,
          artist: s.artist || '',
          category: s.category || 'special',
          language: s.language || 'english',
          popularity: typeof s.popularity === 'number' ? s.popularity : 3,
          mood: Array.isArray(s.mood) ? s.mood : [],
          recommendedFor: Array.isArray(s.recommended_for) ? s.recommended_for : [],
          sortOrder: typeof s.sort_order === 'number' ? s.sort_order : i,
          isActive: s.is_active !== false,
        })
        .onConflictDoUpdate({
          target: songs.id,
          set: {
            title: s.title,
            artist: s.artist || '',
            category: s.category || 'special',
            language: s.language || 'english',
            popularity: typeof s.popularity === 'number' ? s.popularity : 3,
            mood: Array.isArray(s.mood) ? s.mood : [],
            recommendedFor: Array.isArray(s.recommended_for) ? s.recommended_for : [],
            sortOrder: typeof s.sort_order === 'number' ? s.sort_order : i,
            isActive: s.is_active !== false,
            updatedAt: new Date(),
          },
        });
      n++;
    }
    return NextResponse.json({ success: true, upserted: n });
  } catch (err) {
    console.error('[/api/songs POST]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
