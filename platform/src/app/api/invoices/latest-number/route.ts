import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices } from '@/db/schema';
import { requireAuthRoute } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const unauth = await requireAuthRoute();
  if (unauth) return unauth;

  const year = new Date().getFullYear();
  try {
    const all = await db.select({ n: invoices.invoiceNumber }).from(invoices);
    let maxQuo = 0;
    let maxInv = 0;
    for (const { n } of all) {
      if (!n) continue;
      const parts = n.split('-');
      if (parts.length !== 3) continue;
      const yr = Number(parts[1]);
      const seq = Number(parts[2]);
      if (yr !== year || !Number.isFinite(seq)) continue;
      if (parts[0] === 'QUO' && seq > maxQuo) maxQuo = seq;
      if (parts[0] === 'INV' && seq > maxInv) maxInv = seq;
    }
    return NextResponse.json({
      success: true,
      nextQuotation: `QUO-${year}-${String(maxQuo + 1).padStart(3, '0')}`,
      nextInvoice: `INV-${year}-${String(maxInv + 1).padStart(3, '0')}`,
      latestQuoNum: maxQuo,
      latestInvNum: maxInv,
    });
  } catch (err) {
    console.error('[/api/invoices/latest-number]', err);
    return NextResponse.json(
      {
        success: false,
        nextQuotation: `QUO-${year}-001`,
        nextInvoice: `INV-${year}-001`,
        latestQuoNum: 0,
        latestInvNum: 0,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
