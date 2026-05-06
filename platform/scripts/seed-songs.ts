/**
 * One-off: copy static `src/data/songs.ts` into the `songs` table.
 * Run: npx tsx scripts/seed-songs.ts
 * Requires DATABASE_URL in .env.local (loaded by dotenv if you add it, or export manually).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import { songs } from '../src/db/schema';
import { songs as staticSongs } from '../src/data/songs';

config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to platform/.env.local');
    process.exit(1);
  }

  let n = 0;
  for (let i = 0; i < staticSongs.length; i++) {
    const s = staticSongs[i];
    await db
      .insert(songs)
      .values({
        id: s.id,
        title: s.title,
        artist: s.artist,
        category: s.category,
        language: s.language,
        popularity: s.popularity,
        mood: s.mood,
        recommendedFor: s.recommended_for,
        sortOrder: i,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: songs.id,
        set: {
          title: s.title,
          artist: s.artist,
          category: s.category,
          language: s.language,
          popularity: s.popularity,
          mood: s.mood,
          recommendedFor: s.recommended_for,
          sortOrder: i,
          isActive: true,
          updatedAt: sql`now()`,
        },
      });
    n++;
  }
  console.log(`Seeded ${n} songs.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
