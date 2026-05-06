import { NextRequest, NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices } from '@/db/schema';
import { invoiceToRow, rowToInvoice } from '@/db/invoice-mapper';
import { requireAuthRoute } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  try {
    const rows = await db.select().from(invoices).orderBy(desc(invoices.createdAt));
    return NextResponse.json({
      success: true,
      invoices: rows.map(rowToInvoice),
    });
  } catch (err) {
    console.error('[/api/invoices GET]', err);
    return NextResponse.json(
      { success: false, invoices: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const isArray = Array.isArray(body);
  const list = (isArray ? body : [body]) as Array<{ invoiceNumber?: string }>;

  if (list.some((i) => !i || typeof i !== 'object' || !i.invoiceNumber)) {
    return NextResponse.json(
      { success: false, error: 'Each invoice must include invoiceNumber' },
      { status: 400 }
    );
  }

  try {
    let saved = 0;
    for (const inv of list) {
      const row = invoiceToRow(inv as Parameters<typeof invoiceToRow>[0]);
      await db
        .insert(invoices)
        .values(row)
        .onConflictDoUpdate({
          target: invoices.invoiceNumber,
          set: {
            documentType: row.documentType,
            status: row.status,
            clientName: row.clientName,
            clientPhone: row.clientPhone,
            clientEmail: row.clientEmail,
            clientAddress: row.clientAddress,
            eventType: row.eventType,
            eventDate: row.eventDate,
            eventTimeHour: row.eventTimeHour,
            eventTimeMinute: row.eventTimeMinute,
            eventTimePeriod: row.eventTimePeriod,
            eventVenue: row.eventVenue,
            geoLocation: row.geoLocation,
            leadSource: row.leadSource,
            collaborationPartner: row.collaborationPartner,
            items: row.items,
            discount: row.discount,
            discountType: row.discountType,
            depositRequested: row.depositRequested,
            depositPaid: row.depositPaid,
            total: row.total,
            paymentStatus: row.paymentStatus,
            depositReceivedDate: row.depositReceivedDate,
            balanceReceivedDate: row.balanceReceivedDate,
            calendarCreated: row.calendarCreated,
            calendarEventId: row.calendarEventId,
            invoiceSentDate: row.invoiceSentDate,
            receiptSentDate: row.receiptSentDate,
            eventCompletedDate: row.eventCompletedDate,
            feedbackStatus: row.feedbackStatus,
            linkedQuotationNumber: row.linkedQuotationNumber,
            convertedAt: row.convertedAt,
            deletedAt: row.deletedAt,
            updatedAt: sql`now()`,
          },
        });
      saved++;
    }
    return NextResponse.json({ success: true, saved });
  } catch (err) {
    console.error('[/api/invoices POST]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
