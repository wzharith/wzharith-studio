import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices } from '@/db/schema';
import { invoiceToRow, rowToInvoice } from '@/db/invoice-mapper';
import { requireAuthRoute } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { invoiceNumber: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  const number = decodeURIComponent(params.invoiceNumber);
  const rows = await db.select().from(invoices).where(eq(invoices.invoiceNumber, number)).limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, invoice: rowToInvoice(rows[0]) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  const number = decodeURIComponent(params.invoiceNumber);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const merged = { invoiceNumber: number, ...body };
  const row = invoiceToRow(merged as Parameters<typeof invoiceToRow>[0]);

  await db
    .update(invoices)
    .set({ ...row, updatedAt: sql`now()` })
    .where(eq(invoices.invoiceNumber, number));

  const after = await db
    .select()
    .from(invoices)
    .where(eq(invoices.invoiceNumber, number))
    .limit(1);
  if (after.length === 0) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, invoice: rowToInvoice(after[0]) });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  const number = decodeURIComponent(params.invoiceNumber);
  const url = new URL(request.url);
  const hard = url.searchParams.get('hard') === 'true';

  if (hard) {
    await db.delete(invoices).where(eq(invoices.invoiceNumber, number));
    return NextResponse.json({ success: true, hard: true });
  }

  await db
    .update(invoices)
    .set({ deletedAt: new Date(), updatedAt: sql`now()` })
    .where(eq(invoices.invoiceNumber, number));
  return NextResponse.json({ success: true, hard: false });
}
