import { NextRequest, NextResponse } from 'next/server';
import { getAvailability, isCalendarConfigured } from '@/lib/google-calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const month = Number(url.searchParams.get('month'));
  const year = Number(url.searchParams.get('year'));

  if (!Number.isFinite(month) || !Number.isFinite(year)) {
    return NextResponse.json(
      { success: false, error: 'month and year query params required' },
      { status: 400 }
    );
  }

  if (!isCalendarConfigured()) {
    return NextResponse.json({ success: true, month, year, bookedDates: [] });
  }

  try {
    const data = await getAvailability(month, year);
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    console.error('[/api/calendar/availability]', err);
    return NextResponse.json(
      { success: false, month, year, bookedDates: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
