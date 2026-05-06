import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { inquiries, invoices } from '@/db/schema';
import { invoiceToRow } from '@/db/invoice-mapper';
import { requireAuthRoute } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  try {
    const rows = await db.select().from(inquiries).orderBy(desc(inquiries.dateReceived));
    return NextResponse.json({ success: true, inquiries: rows });
  } catch (err) {
    console.error('[/api/inquiries GET]', err);
    return NextResponse.json(
      { success: false, inquiries: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

interface BookingInquiryInput {
  name?: string;
  email?: string;
  phone?: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  packageId?: string;
  packageName?: string;
  packagePrice?: number | string;
  songRequests?: string;
  message?: string;
}

function parseTimeHour(t: string | undefined): string {
  if (!t) return '7';
  const ampm = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) return ampm[1];
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let h = parseInt(m24[1], 10);
    if (h === 0) return '12';
    if (h > 12) h -= 12;
    return String(h);
  }
  return '7';
}

function parseTimeMinute(t: string | undefined): string {
  if (!t) return '00';
  const m = t.match(/:(\d{2})/);
  return m ? m[1] : '00';
}

function parseTimePeriod(t: string | undefined): string {
  if (!t) return 'PM';
  const u = t.toUpperCase();
  if (u.includes('AM')) return 'AM';
  if (u.includes('PM')) return 'PM';
  const m = t.match(/^(\d{1,2}):/);
  if (m) {
    const h = parseInt(m[1], 10);
    return h >= 0 && h < 12 ? 'AM' : 'PM';
  }
  return 'PM';
}

async function generateNextQuotationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const all = await db.select({ n: invoices.invoiceNumber }).from(invoices);
  let max = 0;
  for (const { n } of all) {
    if (!n) continue;
    const parts = n.split('-');
    if (parts.length !== 3 || parts[0] !== 'QUO') continue;
    if (Number(parts[1]) !== year) continue;
    const seq = Number(parts[2]);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return `QUO-${year}-${String(max + 1).padStart(3, '0')}`;
}

export async function POST(request: NextRequest) {
  let inq: BookingInquiryInput;
  try {
    inq = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!inq?.name || !inq?.phone) {
    return NextResponse.json(
      { success: false, error: 'Name and phone are required' },
      { status: 400 }
    );
  }

  try {
    const inquiryId = `INQ-${Date.now()}`;
    const quotationNumber = await generateNextQuotationNumber();

    await db.insert(inquiries).values({
      inquiryId,
      name: String(inq.name ?? ''),
      email: String(inq.email ?? ''),
      phone: String(inq.phone ?? ''),
      eventDate: String(inq.eventDate ?? ''),
      eventTime: String(inq.eventTime ?? ''),
      venue: String(inq.venue ?? ''),
      packageName: String(inq.packageName ?? 'Not specified'),
      songRequests: String(inq.songRequests ?? ''),
      message: String(inq.message ?? ''),
      status: 'new',
      quotationNumber,
      notes: '',
    });

    const packagePrice =
      inq.packagePrice === undefined || inq.packagePrice === ''
        ? 0
        : Number(inq.packagePrice) || 0;

    const items = inq.packageId
      ? [
          {
            id: '1',
            description: String(inq.packageName ?? 'Performance Package'),
            details: 'As discussed',
            quantity: 1,
            rate: packagePrice,
          },
        ]
      : [];

    const draft = invoiceToRow({
      invoiceNumber: quotationNumber,
      documentType: 'quotation',
      status: 'quotation_draft',
      clientName: String(inq.name ?? ''),
      clientPhone: String(inq.phone ?? ''),
      clientEmail: String(inq.email ?? ''),
      clientAddress: '',
      eventType: 'Wedding Reception',
      eventDate: String(inq.eventDate ?? ''),
      eventTimeHour: parseTimeHour(inq.eventTime),
      eventTimeMinute: parseTimeMinute(inq.eventTime),
      eventTimePeriod: parseTimePeriod(inq.eventTime),
      eventVenue: String(inq.venue ?? ''),
      items,
      total: packagePrice,
    });
    await db.insert(invoices).values(draft).onConflictDoNothing({ target: invoices.invoiceNumber });

    return NextResponse.json({ success: true, inquiryId, quotationNumber });
  } catch (err) {
    console.error('[/api/inquiries POST]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
