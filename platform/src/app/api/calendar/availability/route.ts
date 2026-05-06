import { NextRequest, NextResponse } from 'next/server';
import {
  getAvailability,
  isCalendarConfigured,
  isCalendarNotFoundOrInaccessible,
  getCalendarErrorStatus,
} from '@/lib/google-calendar';

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
    if (isCalendarNotFoundOrInaccessible(err)) {
      console.warn(
        '[/api/calendar/availability] Calendar not found or not shared — set GOOGLE_CALENDAR_ID to the ID under Settings → Integrate calendar, and share that calendar with GOOGLE_SERVICE_ACCOUNT_EMAIL (Make changes to events).'
      );
      return NextResponse.json({
        success: true,
        month,
        year,
        bookedDates: [],
        calendarUnreachable: true,
        hint:
          'Google Calendar returned 404. Share the bookings calendar with your service account, or fix GOOGLE_CALENDAR_ID.',
      });
    }
    const status = getCalendarErrorStatus(err);
    if (status === 401 || status === 403) {
      // Most common on Vercel: env var formatting or calendar sharing permissions.
      console.warn('[/api/calendar/availability] Calendar auth/permission error', { status });
      return NextResponse.json(
        {
          success: true,
          month,
          year,
          bookedDates: [],
          calendarUnreachable: true,
          hint:
            'Google Calendar returned 401/403. Check GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY formatting (paste with \\n) and ensure the calendar is shared with the service account email (Make changes to events).',
        },
        { status: 200 }
      );
    }
    console.error('[/api/calendar/availability]', err);
    return NextResponse.json(
      { success: false, month, year, bookedDates: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
