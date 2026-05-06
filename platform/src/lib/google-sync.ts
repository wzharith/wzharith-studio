/**
 * Studio API client.
 *
 * Wraps calls to the Next.js /api routes (Neon-backed). The module name and
 * exported types are unchanged from the previous Google Apps Script version,
 * so consumers don't need to rename imports.
 *
 * NOTE: `isGoogleSyncEnabled()` is retained for backward compatibility but
 * always returns true now — sync runs through our own API routes which are
 * always available when the app is deployed.
 */

export type LeadSource =
  | 'Web'
  | 'Instagram'
  | 'WhatsApp'
  | 'TikTok'
  | 'Referral'
  | 'Collaboration'
  | 'Other'
  | '';

export type InvoiceStatus =
  | 'quotation_draft'
  | 'quotation_sent'
  | 'deposit_received'
  | 'invoice_sent'
  | 'balance_paid'
  | 'completed'
  | 'archived'
  | 'cancelled'
  | 'draft'
  | 'sent'
  | 'paid';

export type PaymentStatus = 'none' | 'deposit' | 'partial' | 'full';
export type FeedbackStatus = 'pending' | 'requested' | 'received' | 'reviewed';

export interface InvoiceItem {
  id: string;
  description: string;
  details: string;
  quantity: number;
  rate: number;
}

export interface StoredInvoice {
  id: string;
  invoiceNumber: string;
  documentType: 'quotation' | 'invoice';
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  eventType: string;
  eventDate: string;
  eventTimeHour: string;
  eventTimeMinute: string;
  eventTimePeriod: string;
  eventVenue: string;
  items: InvoiceItem[];
  discount: number;
  discountType: 'amount' | 'percent';
  depositRequested?: number;
  depositPaid: number;
  total: number;
  createdAt: string;
  status: InvoiceStatus;
  linkedQuotationNumber?: string;
  linkedQuotation?: string;
  convertedAt?: string;
  deletedAt?: string;
  leadSource?: LeadSource;
  collaborationPartner?: string;
  paymentStatus?: PaymentStatus;
  depositReceivedDate?: string;
  balanceReceivedDate?: string;
  calendarEventId?: string;
  calendarCreated?: boolean;
  invoiceSentDate?: string;
  receiptSentDate?: string;
  eventCompletedDate?: string;
  feedbackStatus?: FeedbackStatus;
}

/**
 * Migrate legacy status values to the new system. Pure data transformation —
 * runs locally in the browser as an extra safety net.
 */
export function migrateInvoiceStatus(invoice: StoredInvoice): StoredInvoice {
  const migrated = { ...invoice };

  if (invoice.status === 'draft') {
    migrated.status = invoice.documentType === 'quotation' ? 'quotation_draft' : 'deposit_received';
  } else if (invoice.status === 'sent') {
    migrated.status = invoice.documentType === 'quotation' ? 'quotation_sent' : 'invoice_sent';
  } else if (invoice.status === 'paid') {
    migrated.status = 'balance_paid';
    migrated.paymentStatus = 'full';
  }

  if (!migrated.paymentStatus || migrated.paymentStatus === 'none') {
    if (invoice.depositPaid > 0) {
      const balance = invoice.total - invoice.depositPaid;
      migrated.paymentStatus = balance <= 0 ? 'full' : 'deposit';
    }
  }

  if (!migrated.feedbackStatus) migrated.feedbackStatus = 'pending';
  return migrated;
}

export interface CalendarEvent {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  packageName?: string;
  total: number;
  depositPaid: number;
  invoiceNumber: string;
  notes?: string;
}

export interface AvailabilityData {
  month: number;
  year: number;
  bookedDates: string[];
}

export interface CalendarEventInfo {
  date: string;
  title: string;
  venue: string;
}

export interface InquiryFromSheet {
  inquiryId: string;
  dateReceived: string;
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  packageName: string;
  songRequests: string;
  message: string;
  status: string;
  quotationNumber: string;
}

export interface BookingInquiry {
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  packageId?: string;
  packageName?: string;
  packagePrice?: number;
  songRequests?: string;
  message?: string;
}

/**
 * Always true — kept for backward compatibility. Previously gated calls when
 * `NEXT_PUBLIC_GOOGLE_SCRIPT_URL` was missing; now we always call our own API.
 */
export const isGoogleSyncEnabled = (): boolean => true;

const json = { 'Content-Type': 'application/json' };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// =============================================================================
// INVOICE NUMBERS
// =============================================================================

export interface LatestInvoiceNumber {
  success: boolean;
  nextQuotation: string;
  nextInvoice: string;
  latestQuoNum: number;
  latestInvNum: number;
  error?: string;
}

export const fetchLatestInvoiceNumber = async (): Promise<LatestInvoiceNumber> => {
  const year = new Date().getFullYear();
  const fallback: LatestInvoiceNumber = {
    success: false,
    nextQuotation: `QUO-${year}-001`,
    nextInvoice: `INV-${year}-001`,
    latestQuoNum: 0,
    latestInvNum: 0,
  };
  try {
    const data = await fetchJson<LatestInvoiceNumber>('/api/invoices/latest-number');
    return { ...fallback, ...data, success: !!data.success };
  } catch (err) {
    console.error('[InvoiceNumber] Error:', err);
    return fallback;
  }
};

// =============================================================================
// INVOICES
// =============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export const fetchInvoicesFromCloud = async (): Promise<{
  success: boolean;
  invoices: StoredInvoice[];
  error?: string;
}> => {
  try {
    const data = await fetchJson<{ success: boolean; invoices: StoredInvoice[]; error?: string }>(
      '/api/invoices'
    );
    const list = (data.invoices ?? []).map(migrateInvoiceStatus);
    return { success: data.success !== false, invoices: list, error: data.error };
  } catch (err) {
    console.error('[Fetch] Error:', err);
    return { success: false, invoices: [], error: String(err) };
  }
};

export const saveInvoiceToGoogle = async (
  invoice: StoredInvoice
): Promise<{ success: boolean; error?: string }> => {
  try {
    const data = await fetchJson<{ success: boolean; error?: string }>('/api/invoices', {
      method: 'POST',
      headers: json,
      body: JSON.stringify(invoice),
    });
    return { success: !!data.success, error: data.error };
  } catch (err) {
    console.error('Error saving invoice:', err);
    return { success: false, error: String(err) };
  }
};

export const syncAllInvoices = async (
  invoices: StoredInvoice[]
): Promise<{ success: boolean; saved?: number; error?: string }> => {
  try {
    const data = await fetchJson<{ success: boolean; saved?: number; error?: string }>(
      '/api/invoices',
      {
        method: 'POST',
        headers: json,
        body: JSON.stringify(invoices),
      }
    );
    return { success: !!data.success, saved: data.saved, error: data.error };
  } catch (err) {
    console.error('[Sync] Error:', err);
    return { success: false, error: String(err) };
  }
};

export const updateInvoiceStatus = async (
  invoiceNumber: string,
  status: InvoiceStatus
): Promise<{ success: boolean; error?: string }> => {
  try {
    const data = await fetchJson<{ success: boolean; error?: string }>(
      `/api/invoices/${encodeURIComponent(invoiceNumber)}`,
      {
        method: 'PATCH',
        headers: json,
        body: JSON.stringify({ status }),
      }
    );
    return { success: !!data.success, error: data.error };
  } catch (err) {
    console.error('Error updating status:', err);
    return { success: false, error: String(err) };
  }
};

// =============================================================================
// CALENDAR
// =============================================================================

export const createCalendarEvent = async (
  event: CalendarEvent
): Promise<{ success: boolean; eventId?: string; error?: string }> => {
  try {
    const data = await fetchJson<{ success: boolean; eventId?: string; error?: string }>(
      '/api/calendar/events',
      {
        method: 'POST',
        headers: json,
        body: JSON.stringify(event),
      }
    );
    return data;
  } catch (err) {
    console.error('Error creating calendar event:', err);
    return { success: false, error: String(err) };
  }
};

export const getCalendarEvents = async (): Promise<CalendarEventInfo[]> => {
  try {
    const res = await fetch('/api/calendar/events', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as CalendarEventInfo[] | { events?: CalendarEventInfo[] };
    return Array.isArray(data) ? data : data.events ?? [];
  } catch (err) {
    console.error('Error getting calendar events:', err);
    return [];
  }
};

export const getAvailability = async (
  month: number,
  year: number
): Promise<AvailabilityData | null> => {
  try {
    const data = await fetchJson<{ bookedDates?: string[] }>(
      `/api/calendar/availability?month=${month}&year=${year}`
    );
    return { month, year, bookedDates: data.bookedDates ?? [] };
  } catch (err) {
    console.error('Error getting availability:', err);
    return { month, year, bookedDates: [] };
  }
};

// =============================================================================
// INQUIRIES & SUBSCRIBERS
// =============================================================================

export const saveBookingInquiry = async (
  inquiry: BookingInquiry
): Promise<{
  success: boolean;
  inquiryId?: string;
  quotationNumber?: string;
  error?: string;
}> => {
  try {
    const data = await fetchJson<{
      success: boolean;
      inquiryId?: string;
      quotationNumber?: string;
      error?: string;
    }>('/api/inquiries', {
      method: 'POST',
      headers: json,
      body: JSON.stringify(inquiry),
    });
    return data;
  } catch (err) {
    console.error('Error saving inquiry:', err);
    return { success: false, error: String(err) };
  }
};

export const saveNotificationSubscriber = async (
  phone: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const data = await fetchJson<{ success: boolean; error?: string }>('/api/subscribers', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ phone }),
    });
    return data;
  } catch (err) {
    console.error('[Subscriber] Error:', err);
    return { success: false, error: String(err) };
  }
};

// =============================================================================
// CONFIG
// =============================================================================

export interface SiteConfigFeatures {
  showPortfolio?: boolean;
  showCollaborators?: boolean;
  showDigitalProducts?: boolean;
  showProductLaunchNotify?: boolean;
  showSongCatalog?: boolean;
}

export interface SiteConfigData {
  business_name?: string;
  business_tagline?: string;
  business_ssm?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_whatsapp?: string;
  social_instagram?: string;
  social_tiktok?: string;
  social_youtube?: string;
  social_facebook?: string;
  banking_bank?: string;
  banking_accountName?: string;
  banking_accountNumber?: string;
  features?: SiteConfigFeatures;
  packages?: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    priceDisplay: string;
    priceNote?: string;
    features: string[];
    popular?: boolean;
    songs?: string;
    duration?: string;
    hidden?: boolean;
    includedSegments?: Array<{ name: string; quantity: number }>;
  }>;
  addons?: Array<{
    id: string;
    name: string;
    price: number;
    priceDisplay: string;
    description: string;
  }>;
  collaborationPartners?: string[];
  transport_baseCharge?: number;
  transport_perKmRate?: number;
  transport_freeZone?: string;
  terms_depositPercent?: number;
  terms_balanceDueDays?: number;
  terms_cancellationPolicy?: string;
  terms_latePayment?: string;
}

export const fetchConfig = async (): Promise<{
  success: boolean;
  config: SiteConfigData;
  error?: string;
}> => {
  try {
    const data = await fetchJson<{ success: boolean; config: SiteConfigData; error?: string }>(
      '/api/config'
    );
    return { success: data.success !== false, config: data.config ?? {}, error: data.error };
  } catch (err) {
    console.error('[Config] Error:', err);
    return { success: false, config: {}, error: String(err) };
  }
};

export const saveConfigToGoogle = async (
  config: SiteConfigData
): Promise<{ success: boolean; error?: string }> => {
  try {
    const data = await fetchJson<{ success: boolean; error?: string }>('/api/config', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ data: config }),
    });
    return { success: !!data.success, error: data.error };
  } catch (err) {
    console.error('[Config] Error:', err);
    return { success: false, error: String(err) };
  }
};

// =============================================================================
// CONFIG HISTORY
// =============================================================================

export interface ConfigHistoryEntry {
  year: number;
  packages: Array<{
    id: string;
    name: string;
    price: number;
    priceDisplay: string;
    description: string;
  }>;
  addons: Array<{
    id: string;
    name: string;
    price: number;
    priceDisplay: string;
    description: string;
  }>;
  businessInfo: {
    business_name?: string;
    business_tagline?: string;
    contact_phone?: string;
    contact_email?: string;
    banking_bank?: string;
    banking_accountName?: string;
    banking_accountNumber?: string;
  };
  archivedAt: string;
  notes: string;
}

export const archiveConfig = async (
  year?: number
): Promise<{ success: boolean; year?: number; error?: string }> => {
  try {
    const data = await fetchJson<{ success: boolean; year?: number; error?: string }>(
      '/api/config/archive',
      {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ year: year ?? new Date().getFullYear() }),
      }
    );
    return data;
  } catch (err) {
    console.error('[ConfigHistory] Archive error:', err);
    return { success: false, error: String(err) };
  }
};

export const fetchConfigHistory = async (): Promise<{
  success: boolean;
  history: ConfigHistoryEntry[];
  error?: string;
}> => {
  try {
    const data = await fetchJson<{
      success: boolean;
      history: ConfigHistoryEntry[];
      error?: string;
    }>('/api/config/history');
    return { success: data.success !== false, history: data.history ?? [], error: data.error };
  } catch (err) {
    console.error('[ConfigHistory] Error:', err);
    return { success: false, history: [], error: String(err) };
  }
};
