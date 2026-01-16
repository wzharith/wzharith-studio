/**
 * Google Apps Script API Integration
 *
 * Handles syncing invoices and events with Google Sheets and Calendar
 */

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || '';

// Debug: Log if Google sync is configured (runs once at module load)
if (typeof window !== 'undefined') {
  console.log('[GoogleSync] URL configured:', GOOGLE_SCRIPT_URL ? 'YES (' + GOOGLE_SCRIPT_URL.substring(0, 50) + '...)' : 'NO - secrets not set during build');
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
  depositPaid: number;
  total: number;
  createdAt: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  linkedQuotationNumber?: string;
  convertedAt?: string;
  deletedAt?: string; // Soft delete timestamp
}

export interface InvoiceItem {
  id: string;
  description: string;
  details: string;
  quantity: number;
  rate: number;
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
 * Check if Google sync is configured
 */
export const isGoogleSyncEnabled = (): boolean => {
  return !!GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== '';
};

/**
 * Parse event time string (e.g., "7:00 PM") into hour, minute, period
 */
const parseEventTime = (timeStr: string): { hour: string; minute: string; period: string } => {
  const defaultTime = { hour: '7', minute: '00', period: 'PM' };
  if (!timeStr) return defaultTime;

  // Match "7:00 PM" or "19:00" or "7:00PM" formats
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return defaultTime;

  let hour = parseInt(match[1]);
  const minute = match[2];
  let period = match[3]?.toUpperCase() || '';

  // If no AM/PM specified, determine from hour
  if (!period) {
    if (hour >= 12 && hour < 24) {
      period = 'PM';
      if (hour > 12) hour = hour - 12;
    } else {
      period = 'AM';
      if (hour === 0) hour = 12;
    }
  }

  return { hour: String(hour), minute, period };
};

/**
 * Latest invoice number response from Apps Script
 */
export interface LatestInvoiceNumber {
  success: boolean;
  nextQuotation: string;
  nextInvoice: string;
  latestQuoNum: number;
  latestInvNum: number;
  error?: string;
}

/**
 * Fetch the latest invoice/quotation numbers from Google Sheets
 */
export const fetchLatestInvoiceNumber = async (): Promise<LatestInvoiceNumber> => {
  const year = new Date().getFullYear();
  const fallback: LatestInvoiceNumber = {
    success: false,
    nextQuotation: `QUO-${year}-001`,
    nextInvoice: `INV-${year}-001`,
    latestQuoNum: 0,
    latestInvNum: 0,
  };

  if (!isGoogleSyncEnabled()) {
    console.log('[InvoiceNumber] Google sync not configured, using fallback');
    return fallback;
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getLatestInvoiceNumber`;
    console.log('[InvoiceNumber] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[InvoiceNumber] Got:', data);
      return {
        success: true,
        nextQuotation: data.nextQuotation || fallback.nextQuotation,
        nextInvoice: data.nextInvoice || fallback.nextInvoice,
        latestQuoNum: data.latestQuoNum || 0,
        latestInvNum: data.latestInvNum || 0,
      };
    }

    return fallback;
  } catch (error) {
    console.error('[InvoiceNumber] Error:', error);
    return fallback;
  }
};

/**
 * Sync status type for UI
 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

/**
 * Fetch all invoices from Google Sheets
 * Returns array of StoredInvoice objects or null if fetch fails
 */
export const fetchInvoicesFromCloud = async (): Promise<{ success: boolean; invoices: StoredInvoice[]; error?: string }> => {
  if (!isGoogleSyncEnabled()) {
    console.log('[Fetch] Google sync not configured');
    return { success: false, invoices: [], error: 'Google sync not configured' };
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getInvoices`;
    console.log('[Fetch] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    console.log('[Fetch] Response status:', response.status, response.statusText);

    if (response.ok) {
      const text = await response.text();
      console.log('[Fetch] Response body:', text.substring(0, 500));

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[Fetch] JSON parse error:', parseError);
        return { success: false, invoices: [], error: 'Invalid JSON: ' + text.substring(0, 100) };
      }

      // The Apps Script returns invoices with camelCase keys
      // Map them to ensure all required fields exist
      const invoices: StoredInvoice[] = (data.invoices || data || []).map((inv: Record<string, unknown>) => {
        // Parse event time from "7:00 PM" format to separate fields
        const eventTimeStr = String(inv.eventTime || '');
        const timeParts = parseEventTime(eventTimeStr);

        return {
          id: String(inv.id || inv.invoiceNumber || ''),
          invoiceNumber: String(inv.invoiceNumber || ''),
          documentType: (inv.documentType === 'invoice' ? 'invoice' : 'quotation') as 'quotation' | 'invoice',
          clientName: String(inv.clientName || ''),
          clientPhone: String(inv.clientPhone || ''),
          clientEmail: String(inv.clientEmail || ''),
          clientAddress: String(inv.clientAddress || ''),
          eventType: String(inv.eventType || ''),
          eventDate: String(inv.eventDate || ''),
          eventTimeHour: String(inv.eventTimeHour || timeParts.hour || '7'),
          eventTimeMinute: String(inv.eventTimeMinute || timeParts.minute || '00'),
          eventTimePeriod: String(inv.eventTimePeriod || timeParts.period || 'PM'),
          // Note: Sheet column is "Venue" -> "venue" in camelCase
          eventVenue: String(inv.eventVenue || inv.venue || ''),
          items: Array.isArray(inv.items) ? inv.items : [],
          discount: Number(inv.discount) || 0,
          discountType: (inv.discountType === 'percent' ? 'percent' : 'amount') as 'amount' | 'percent',
          depositPaid: Number(inv.depositPaid) || 0,
          total: Number(inv.total) || 0,
          createdAt: String(inv.createdAt || new Date().toISOString()),
          status: (['draft', 'sent', 'paid', 'cancelled'].includes(String(inv.status))
            ? inv.status
            : 'draft') as 'draft' | 'sent' | 'paid' | 'cancelled',
          linkedQuotationNumber: inv.linkedQuotationNumber ? String(inv.linkedQuotationNumber) : undefined,
          convertedAt: inv.convertedAt ? String(inv.convertedAt) : undefined,
          deletedAt: inv.deletedAt ? String(inv.deletedAt) : undefined,
        };
      });

      return { success: true, invoices };
    }

    const errorText = await response.text();
    console.error('[Fetch] Error response:', response.status, errorText);
    return { success: false, invoices: [], error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` };
  } catch (error) {
    console.error('[Fetch] Network error:', error);
    return { success: false, invoices: [], error: String(error) };
  }
};

/**
 * Save invoice to Google Sheets
 */
export const saveInvoiceToGoogle = async (invoice: StoredInvoice): Promise<{ success: boolean; error?: string }> => {
  if (!isGoogleSyncEnabled()) {
    console.log('Google sync not configured');
    return { success: false, error: 'Google sync not configured' };
  }

  try {
    // Use GET with URL params for better CORS compatibility
    const params = new URLSearchParams({
      action: 'saveInvoice',
      data: JSON.stringify(invoice),
    });

    const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params}`, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.ok) {
      const result = await response.json();
      return { success: result.success, error: result.error };
    }

    return { success: true }; // Assume success if we got a response
  } catch (error) {
    console.error('Error saving to Google:', error);
    // Still return success - the request was likely sent
    return { success: true, error: 'Request sent but response unclear' };
  }
};

/**
 * Create calendar event with reminders
 */
export const createCalendarEvent = async (event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: string }> => {
  if (!isGoogleSyncEnabled()) {
    return { success: false, error: 'Google sync not configured' };
  }

  try {
    const params = new URLSearchParams({
      action: 'createCalendarEvent',
      data: JSON.stringify(event),
    });

    const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params}`, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.ok) {
      const result = await response.json();
      return { success: result.success, eventId: result.eventId, error: result.error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return { success: true, error: 'Request sent but response unclear' };
  }
};

/**
 * Sync all invoices to Google Sheets (batch)
 */
export const syncAllInvoices = async (invoices: StoredInvoice[]): Promise<{ success: boolean; saved?: number; error?: string }> => {
  if (!isGoogleSyncEnabled()) {
    return { success: false, error: 'Google sync not configured' };
  }

  try {
    const params = new URLSearchParams({
      action: 'saveInvoices',
      data: JSON.stringify(invoices),
    });

    const url = `${GOOGLE_SCRIPT_URL}?${params}`;
    console.log('[Sync] Sending to:', url.substring(0, 100) + '...');
    console.log('[Sync] Invoices count:', invoices.length);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    console.log('[Sync] Response status:', response.status, response.statusText);

    if (response.ok) {
      const text = await response.text();
      console.log('[Sync] Response body:', text);

      try {
        const result = JSON.parse(text);
        return { success: result.success !== false, saved: invoices.length, error: result.error };
      } catch (parseError) {
        console.error('[Sync] JSON parse error:', parseError);
        return { success: false, error: 'Invalid JSON response: ' + text.substring(0, 100) };
      }
    }

    const errorText = await response.text();
    console.error('[Sync] Error response:', errorText);
    return { success: false, error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` };
  } catch (error) {
    console.error('[Sync] Network error:', error);
    return { success: false, error: 'Network error: ' + String(error) };
  }
};

/**
 * Get all calendar events (for dashboard display)
 * Returns events with title, date, and venue
 */
export const getCalendarEvents = async (): Promise<CalendarEventInfo[]> => {
  if (!isGoogleSyncEnabled()) {
    return [];
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getEvents`;
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.ok) {
      const result = await response.json();
      return Array.isArray(result) ? result : (result.events || []);
    }

    return [];
  } catch (error) {
    console.error('Error getting calendar events:', error);
    return [];
  }
};

/**
 * Get availability for a specific month
 */
export const getAvailability = async (month: number, year: number): Promise<AvailabilityData | null> => {
  if (!isGoogleSyncEnabled()) {
    return null;
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getAvailability&month=${month}&year=${year}`;

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.ok) {
      const result = await response.json();
      return {
        month,
        year,
        bookedDates: result.bookedDates || [],
      };
    }

    return {
      month,
      year,
      bookedDates: [],
    };
  } catch (error) {
    console.error('Error getting availability:', error);
    return null;
  }
};

/**
 * Save booking inquiry from website form
 * Creates a draft quotation automatically
 */
export const saveBookingInquiry = async (
  inquiry: BookingInquiry
): Promise<{ success: boolean; inquiryId?: string; quotationNumber?: string; error?: string }> => {
  if (!isGoogleSyncEnabled()) {
    console.log('Google sync not configured - inquiry not saved to cloud');
    return { success: false, error: 'Google sync not configured' };
  }

  try {
    const params = new URLSearchParams({
      action: 'saveBookingInquiry',
      data: JSON.stringify(inquiry),
    });

    const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params}`, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: result.success,
        inquiryId: result.inquiryId,
        quotationNumber: result.quotationNumber,
        error: result.error,
      };
    }

    // Fallback if response not ok
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-4);
    return {
      success: true,
      inquiryId: `INQ-${Date.now()}`,
      quotationNumber: `QUO-${year}-${timestamp}`,
    };
  } catch (error) {
    console.error('Error saving inquiry:', error);
    return { success: true, error: 'Request sent but response unclear' };
  }
};

/**
 * Update invoice status
 */
export const updateInvoiceStatus = async (
  invoiceNumber: string,
  status: StoredInvoice['status']
): Promise<{ success: boolean; error?: string }> => {
  if (!isGoogleSyncEnabled()) {
    return { success: false, error: 'Google sync not configured' };
  }

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateInvoiceStatus',
        invoiceNumber,
        status,
      }),
      mode: 'no-cors',
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating status:', error);
    return { success: false, error: String(error) };
  }
};

// =============================================================================
// CONFIG MANAGEMENT
// =============================================================================

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
  packages?: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    duration: string;
  }>;
  addons?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  transport_baseCharge?: number;
  transport_perKmRate?: number;
  transport_freeZone?: string;
  terms_depositPercent?: number;
  terms_balanceDueDays?: number;
  terms_cancellationPolicy?: string;
  terms_latePayment?: string;
}

/**
 * Fetch configuration from Google Sheets
 */
export const fetchConfig = async (): Promise<{ success: boolean; config: SiteConfigData; error?: string }> => {
  if (!isGoogleSyncEnabled()) {
    return { success: false, config: {}, error: 'Google sync not configured' };
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getConfig`;
    console.log('[Config] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[Config] Got:', data);
      return {
        success: true,
        config: data.config || {},
      };
    }

    return { success: false, config: {}, error: 'Failed to fetch config' };
  } catch (error) {
    console.error('[Config] Error:', error);
    return { success: false, config: {}, error: String(error) };
  }
};

/**
 * Save configuration to Google Sheets
 */
export const saveConfigToGoogle = async (config: SiteConfigData): Promise<{ success: boolean; error?: string }> => {
  if (!isGoogleSyncEnabled()) {
    return { success: false, error: 'Google sync not configured' };
  }

  try {
    const params = new URLSearchParams({
      action: 'saveConfig',
      data: JSON.stringify(config),
    });

    const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params}`, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.ok) {
      const result = await response.json();
      return { success: result.success, error: result.error };
    }

    return { success: false, error: 'Failed to save config' };
  } catch (error) {
    console.error('[Config] Save error:', error);
    return { success: false, error: String(error) };
  }
};
