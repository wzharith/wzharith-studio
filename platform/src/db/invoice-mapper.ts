import type { Invoice, NewInvoice } from './schema';
import { normalizeInvoiceNumber } from '@/lib/invoice-dedupe';

/**
 * Camel-case shape returned to the frontend (matches StoredInvoice in @/lib/studio-api).
 * Empty strings are preserved (the UI tolerates them); the optional fields are returned
 * as `undefined` only for `linkedQuotationNumber`/`convertedAt`/`deletedAt` to keep the
 * frontend's existing handling consistent.
 */
export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  documentType: 'quotation' | 'invoice';
  status: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  eventType: string;
  eventDate: string;
  eventTime?: string;
  eventTimeHour: string;
  eventTimeMinute: string;
  eventTimePeriod: string;
  eventVenue: string;
  geoLocation?: string;
  leadSource?: string;
  collaborationPartner?: string;
  items: unknown[];
  discount: number;
  discountType: 'amount' | 'percent';
  depositRequested?: number;
  depositPaid: number;
  total: number;
  paymentStatus?: string;
  depositReceivedDate?: string;
  balanceReceivedDate?: string;
  calendarCreated?: boolean;
  calendarEventId?: string;
  invoiceSentDate?: string;
  receiptSentDate?: string;
  eventCompletedDate?: string;
  feedbackStatus?: string;
  linkedQuotationNumber?: string;
  linkedQuotation?: string;
  convertedAt?: string;
  notes?: string;
  songSelections?: Array<{ songId: string; title?: string; artist?: string }>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function rowToInvoice(row: Invoice): InvoiceDTO {
  const dt = row.documentType === 'invoice' ? 'invoice' : 'quotation';
  const dtype = row.discountType === 'percent' ? 'percent' : 'amount';
  return {
    id: row.id,
    invoiceNumber: normalizeInvoiceNumber(row.invoiceNumber),
    documentType: dt,
    status: row.status,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    clientEmail: row.clientEmail,
    clientAddress: row.clientAddress,
    eventType: row.eventType,
    eventDate: row.eventDate,
    eventTime: `${row.eventTimeHour}:${row.eventTimeMinute} ${row.eventTimePeriod}`.trim(),
    eventTimeHour: row.eventTimeHour,
    eventTimeMinute: row.eventTimeMinute,
    eventTimePeriod: row.eventTimePeriod,
    eventVenue: row.eventVenue,
    geoLocation: row.geoLocation || undefined,
    leadSource: row.leadSource || undefined,
    collaborationPartner: row.collaborationPartner || undefined,
    items: Array.isArray(row.items) ? (row.items as unknown[]) : [],
    discount: row.discount,
    discountType: dtype,
    depositRequested: row.depositRequested,
    depositPaid: row.depositPaid,
    total: row.total,
    paymentStatus: row.paymentStatus || undefined,
    depositReceivedDate: row.depositReceivedDate || undefined,
    balanceReceivedDate: row.balanceReceivedDate || undefined,
    calendarCreated: row.calendarCreated,
    calendarEventId: row.calendarEventId || undefined,
    invoiceSentDate: row.invoiceSentDate || undefined,
    receiptSentDate: row.receiptSentDate || undefined,
    eventCompletedDate: row.eventCompletedDate || undefined,
    feedbackStatus: row.feedbackStatus || undefined,
    linkedQuotationNumber: row.linkedQuotationNumber
      ? normalizeInvoiceNumber(row.linkedQuotationNumber)
      : undefined,
    linkedQuotation: row.linkedQuotationNumber
      ? normalizeInvoiceNumber(row.linkedQuotationNumber)
      : undefined,
    convertedAt: row.convertedAt || undefined,
    notes: row.notes || undefined,
    songSelections: Array.isArray(row.songSelections)
      ? (row.songSelections as InvoiceDTO['songSelections'])
      : [],
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    deletedAt: row.deletedAt
      ? row.deletedAt instanceof Date
        ? row.deletedAt.toISOString()
        : String(row.deletedAt)
      : undefined,
  };
}

interface IncomingInvoice {
  invoiceNumber: string;
  documentType?: 'quotation' | 'invoice';
  status?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  eventType?: string;
  eventDate?: string;
  eventTimeHour?: string;
  eventTimeMinute?: string;
  eventTimePeriod?: string;
  eventVenue?: string;
  geoLocation?: string;
  leadSource?: string;
  collaborationPartner?: string;
  items?: unknown[];
  discount?: number | string;
  discountType?: 'amount' | 'percent';
  depositRequested?: number | string;
  depositPaid?: number | string;
  total?: number | string;
  paymentStatus?: string;
  depositReceivedDate?: string;
  balanceReceivedDate?: string;
  calendarCreated?: boolean | string;
  calendarEventId?: string;
  invoiceSentDate?: string;
  receiptSentDate?: string;
  eventCompletedDate?: string;
  feedbackStatus?: string;
  linkedQuotationNumber?: string;
  convertedAt?: string;
  createdAt?: string;
  deletedAt?: string | null;
  notes?: string;
  songSelections?: Array<{ songId: string; title?: string; artist?: string }>;
}

const num = (v: number | string | undefined, def = 0): number => {
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
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1' || v.toUpperCase() === 'TRUE';
  return !!v;
};

export function invoiceToRow(input: IncomingInvoice): NewInvoice {
  const dt = input.documentType === 'invoice' ? 'invoice' : 'quotation';
  const dtype = input.discountType === 'percent' ? 'percent' : 'amount';
  const quoLink = str(input.linkedQuotationNumber);
  return {
    invoiceNumber: normalizeInvoiceNumber(str(input.invoiceNumber)),
    documentType: dt,
    status: str(input.status, 'quotation_draft'),
    clientName: str(input.clientName),
    clientPhone: str(input.clientPhone),
    clientEmail: str(input.clientEmail),
    clientAddress: str(input.clientAddress),
    eventType: str(input.eventType),
    eventDate: str(input.eventDate),
    eventTimeHour: str(input.eventTimeHour, '7'),
    eventTimeMinute: str(input.eventTimeMinute, '00'),
    eventTimePeriod: str(input.eventTimePeriod, 'PM'),
    eventVenue: str(input.eventVenue),
    geoLocation: str(input.geoLocation),
    leadSource: str(input.leadSource),
    collaborationPartner: str(input.collaborationPartner),
    items: Array.isArray(input.items) ? input.items : [],
    discount: num(input.discount),
    discountType: dtype,
    depositRequested: num(input.depositRequested),
    depositPaid: num(input.depositPaid),
    total: num(input.total),
    paymentStatus: str(input.paymentStatus, 'none'),
    depositReceivedDate: str(input.depositReceivedDate),
    balanceReceivedDate: str(input.balanceReceivedDate),
    calendarCreated: bool(input.calendarCreated),
    calendarEventId: str(input.calendarEventId),
    invoiceSentDate: str(input.invoiceSentDate),
    receiptSentDate: str(input.receiptSentDate),
    eventCompletedDate: str(input.eventCompletedDate),
    feedbackStatus: str(input.feedbackStatus, 'pending'),
    linkedQuotationNumber: quoLink ? normalizeInvoiceNumber(quoLink) : '',
    convertedAt: str(input.convertedAt),
    deletedAt: input.deletedAt ? new Date(input.deletedAt) : null,
    notes: str(input.notes),
    songSelections: Array.isArray(input.songSelections) ? input.songSelections : [],
  };
}
