import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices } from '@/db/schema';
import {
  createOrUpdatePerformanceEvent,
  isCalendarConfigured,
  listPerformanceEvents,
  type CreateCalendarEventInput,
} from '@/lib/google-calendar';
import { requireAuthRoute } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isCalendarConfigured()) {
    return NextResponse.json([]);
  }
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date'); // YYYY-MM-DD
    const from = url.searchParams.get('from'); // YYYY-MM-DD
    const to = url.searchParams.get('to'); // YYYY-MM-DD

    // Backward compatible: no params = next 12 months
    if (!date && !from && !to) {
      const events = await listPerformanceEvents();
      return NextResponse.json(events);
    }

    // date=YYYY-MM-DD → that single day (inclusive)
    if (date) {
      const start = new Date(`${date}T00:00:00+08:00`);
      const end = new Date(`${date}T23:59:59+08:00`);
      const events = await listPerformanceEvents(start, end);
      return NextResponse.json(events);
    }

    // from/to range (inclusive); missing bound becomes defaults
    const start = from ? new Date(`${from}T00:00:00+08:00`) : undefined;
    const end = to ? new Date(`${to}T23:59:59+08:00`) : undefined;
    const events = await listPerformanceEvents(start, end);
    return NextResponse.json(events);
  } catch (err) {
    console.error('[/api/calendar/events GET]', err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  let body: Partial<CreateCalendarEventInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const required = ['clientName', 'eventDate', 'eventTime', 'invoiceNumber'] as const;
  for (const k of required) {
    if (!body?.[k]) {
      return NextResponse.json({ success: false, error: `${k} is required` }, { status: 400 });
    }
  }

  if (!isCalendarConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Google Calendar API is not configured on the server' },
      { status: 503 }
    );
  }

  try {
    const result = await createOrUpdatePerformanceEvent({
      clientName: String(body.clientName),
      clientPhone: String(body.clientPhone ?? ''),
      clientEmail: String(body.clientEmail ?? ''),
      eventType: String(body.eventType ?? 'Wedding'),
      eventDate: String(body.eventDate),
      eventTime: String(body.eventTime),
      venue: String(body.venue ?? ''),
      packageName: body.packageName ? String(body.packageName) : undefined,
      total: Number(body.total ?? 0),
      depositPaid: Number(body.depositPaid ?? 0),
      invoiceNumber: String(body.invoiceNumber),
      notes: body.notes ? String(body.notes) : undefined,
    });

    if (result.success && result.eventId && body.invoiceNumber) {
      try {
        await db
          .update(invoices)
          .set({ calendarCreated: true, calendarEventId: result.eventId })
          .where(eq(invoices.invoiceNumber, String(body.invoiceNumber)));
      } catch (storeErr) {
        console.warn('[/api/calendar/events POST] failed to record event id', storeErr);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/calendar/events POST]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
