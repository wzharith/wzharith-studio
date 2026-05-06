/**
 * One-off migration: pull data from the old Google Apps Script Web App and
 * insert it into Neon. Safe to re-run; uses ON CONFLICT to upsert by natural
 * key (invoice_number / config key / inquiry id / phone / year).
 *
 * Usage:
 *   1. In platform/.env.local set:
 *        NEXT_PUBLIC_GOOGLE_SCRIPT_URL=https://script.google.com/.../exec
 *        DATABASE_URL=postgres://...neon.tech/...
 *   2. Run: npm run migrate:sheets
 *   3. Verify counts in Neon and remove NEXT_PUBLIC_GOOGLE_SCRIPT_URL.
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, '../.env.local') });

import { eq, sql as drizzleSql } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import {
  invoices,
  configKv,
  configHistory,
  inquiries,
  subscribers,
} from '../src/db/schema';

const SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SCRIPT_URL) {
  console.error('NEXT_PUBLIC_GOOGLE_SCRIPT_URL is not set in .env.local');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const dbSql = neon(DATABASE_URL);
const db = drizzle(dbSql);

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return (await res.json()) as T;
}

const num = (v: unknown, def = 0): number => {
  if (v === undefined || v === null || v === '') return def;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : def;
};
const str = (v: unknown, def = ''): string => {
  if (v === undefined || v === null) return def;
  return String(v);
};
const bool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toUpperCase() === 'TRUE' || v === '1' || v.toLowerCase() === 'true';
  return !!v;
};

interface AnyObj {
  [k: string]: unknown;
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const str = String(v);
  if (!str) return null;
  const d = new Date(str);
  return Number.isFinite(d.getTime()) ? d : null;
}

async function migrateInvoicesFromSheets(): Promise<number> {
  const data = await fetchJson<{ success: boolean; invoices?: AnyObj[] }>(
    `${SCRIPT_URL}?action=getInvoices`
  );
  const list = data.invoices ?? [];
  let saved = 0;
  for (const raw of list) {
    if (!raw.invoiceNumber) continue;

    // Lead source can be "Type: Detail"
    let leadSource = str(raw.leadSource);
    let collaborationPartner = str(raw.collaborationPartner);
    for (const t of ['Collaboration', 'Referral', 'Other']) {
      const prefix = `${t}: `;
      if (leadSource.startsWith(prefix)) {
        collaborationPartner = leadSource.slice(prefix.length);
        leadSource = t;
        break;
      }
    }

    const eventTime = str(raw.eventTime, '');
    const m = eventTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    let hour = m ? m[1] : str(raw.eventTimeHour, '7');
    const minute = m ? m[2] : str(raw.eventTimeMinute, '00');
    let period = m?.[3]?.toUpperCase() ?? str(raw.eventTimePeriod, 'PM');
    if (!m && eventTime.match(/^\d{1,2}:\d{2}$/)) {
      const h = parseInt(eventTime.split(':')[0], 10);
      if (h === 0) {
        hour = '12';
        period = 'AM';
      } else if (h > 12) {
        hour = String(h - 12);
        period = 'PM';
      } else {
        hour = String(h);
        period = h >= 12 ? 'PM' : 'AM';
      }
    }

    const items = Array.isArray(raw.items) ? raw.items : [];

    const row = {
      invoiceNumber: str(raw.invoiceNumber),
      documentType: raw.documentType === 'invoice' ? 'invoice' : 'quotation',
      status: str(raw.status, 'quotation_draft'),
      clientName: str(raw.clientName),
      clientPhone: str(raw.clientPhone),
      clientEmail: str(raw.clientEmail),
      clientAddress: str(raw.clientAddress),
      eventType: str(raw.eventType),
      eventDate: str(raw.eventDate),
      eventTimeHour: hour,
      eventTimeMinute: minute,
      eventTimePeriod: period,
      eventVenue: str(raw.eventVenue ?? raw.venue),
      geoLocation: str(raw.geoLocation),
      leadSource,
      collaborationPartner,
      items,
      discount: num(raw.discount),
      discountType: raw.discountType === 'percent' ? 'percent' : 'amount',
      depositRequested: num(raw.depositRequested),
      depositPaid: num(raw.depositPaid),
      total: num(raw.total),
      paymentStatus: str(raw.paymentStatus, 'none'),
      depositReceivedDate: str(raw.depositReceivedDate),
      balanceReceivedDate: str(raw.balanceReceivedDate),
      calendarCreated: bool(raw.calendarCreated),
      calendarEventId: str(raw.calendarEventId),
      invoiceSentDate: str(raw.invoiceSentDate),
      receiptSentDate: str(raw.receiptSentDate),
      eventCompletedDate: str(raw.eventCompletedDate),
      feedbackStatus: str(raw.feedbackStatus, 'pending'),
      linkedQuotationNumber: str(raw.linkedQuotation ?? raw.linkedQuotationNumber),
      convertedAt: str(raw.convertedAt),
      createdAt: parseDate(raw.createdAt) ?? new Date(),
      deletedAt: parseDate(raw.deletedAt),
    } as typeof invoices.$inferInsert;

    await db
      .insert(invoices)
      .values(row)
      .onConflictDoUpdate({ target: invoices.invoiceNumber, set: row });
    saved++;
  }
  return saved;
}

async function migrateConfigFromSheets(): Promise<number> {
  const data = await fetchJson<{ success: boolean; config?: AnyObj }>(
    `${SCRIPT_URL}?action=getConfig`
  );
  const cfg = data.config ?? {};
  let saved = 0;
  for (const [key, value] of Object.entries(cfg)) {
    const type = typeof value === 'object' && value !== null
      ? 'json'
      : typeof value === 'number'
        ? 'number'
        : typeof value === 'boolean'
          ? 'boolean'
          : 'string';
    await db
      .insert(configKv)
      .values({ key, value: value as never, type })
      .onConflictDoUpdate({
        target: configKv.key,
        set: { value: value as never, type, updatedAt: drizzleSql`now()` },
      });
    saved++;
  }
  return saved;
}

interface ConfigHistoryEntryRaw {
  year: number | string;
  packages?: unknown[];
  addons?: unknown[];
  businessInfo?: AnyObj;
  notes?: string;
}

async function migrateConfigHistoryFromSheets(): Promise<number> {
  const data = await fetchJson<{ success: boolean; history?: ConfigHistoryEntryRaw[] }>(
    `${SCRIPT_URL}?action=getConfigHistory`
  );
  const history = data.history ?? [];
  let saved = 0;
  for (const entry of history) {
    const year = Number(entry.year);
    if (!Number.isFinite(year)) continue;
    const snapshot = {
      packages: entry.packages ?? [],
      addons: entry.addons ?? [],
      businessInfo: entry.businessInfo ?? {},
    };
    const existing = await db
      .select()
      .from(configHistory)
      .where(eq(configHistory.year, year))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(configHistory)
        .set({ snapshot, notes: str(entry.notes) })
        .where(eq(configHistory.year, year));
    } else {
      await db.insert(configHistory).values({ year, snapshot, notes: str(entry.notes) });
    }
    saved++;
  }
  return saved;
}

interface InquiryRaw {
  inquiryId?: string;
  dateReceived?: string;
  name?: string;
  email?: string;
  phone?: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  packageName?: string;
  songRequests?: string;
  message?: string;
  status?: string;
  quotationNumber?: string;
  notes?: string;
}

async function migrateInquiriesFromSheets(): Promise<number> {
  // The Apps Script doesn't expose getInquiries today. Try a best-effort call;
  // if not available, skip silently.
  let list: InquiryRaw[] = [];
  try {
    const data = await fetchJson<{ inquiries?: InquiryRaw[] }>(`${SCRIPT_URL}?action=getInquiries`);
    list = data.inquiries ?? [];
  } catch {
    return 0;
  }
  let saved = 0;
  for (const raw of list) {
    if (!raw.inquiryId) continue;
    const row = {
      inquiryId: str(raw.inquiryId),
      dateReceived: parseDate(raw.dateReceived) ?? new Date(),
      name: str(raw.name),
      email: str(raw.email),
      phone: str(raw.phone),
      eventDate: str(raw.eventDate),
      eventTime: str(raw.eventTime),
      venue: str(raw.venue),
      packageName: str(raw.packageName),
      songRequests: str(raw.songRequests),
      message: str(raw.message),
      status: str(raw.status, 'new'),
      quotationNumber: str(raw.quotationNumber),
      notes: str(raw.notes),
    } as typeof inquiries.$inferInsert;
    await db
      .insert(inquiries)
      .values(row)
      .onConflictDoUpdate({ target: inquiries.inquiryId, set: row });
    saved++;
  }
  return saved;
}

interface SubscriberRaw {
  phone?: string;
  createdAt?: string;
}

async function migrateSubscribersFromSheets(): Promise<number> {
  let list: SubscriberRaw[] = [];
  try {
    const data = await fetchJson<{ subscribers?: SubscriberRaw[] }>(
      `${SCRIPT_URL}?action=getSubscribers`
    );
    list = data.subscribers ?? [];
  } catch {
    return 0;
  }
  let saved = 0;
  for (const raw of list) {
    if (!raw.phone) continue;
    await db
      .insert(subscribers)
      .values({ phone: str(raw.phone) })
      .onConflictDoNothing({ target: subscribers.phone });
    saved++;
  }
  return saved;
}

async function main() {
  console.log('=== Migration: Google Sheets → Neon ===');
  console.log(`Source: ${SCRIPT_URL}`);
  console.log('');

  console.log('1) Invoices...');
  const invCount = await migrateInvoicesFromSheets();
  console.log(`   ${invCount} invoices upserted.`);

  console.log('2) Config...');
  const cfgCount = await migrateConfigFromSheets();
  console.log(`   ${cfgCount} config keys upserted.`);

  console.log('3) Config history...');
  const histCount = await migrateConfigHistoryFromSheets();
  console.log(`   ${histCount} archived years upserted.`);

  console.log('4) Inquiries (best-effort)...');
  const inqCount = await migrateInquiriesFromSheets();
  console.log(`   ${inqCount} inquiries upserted.`);

  console.log('5) Subscribers (best-effort)...');
  const subCount = await migrateSubscribersFromSheets();
  console.log(`   ${subCount} subscribers upserted.`);

  console.log('');
  console.log('Done. Verify in Neon (npm run db:studio) before retiring Sheets.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
