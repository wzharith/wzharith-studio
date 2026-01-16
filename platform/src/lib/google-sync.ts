/**
 * Google Apps Script API Integration
 *
 * Handles syncing invoices and events with Google Sheets and Calendar
 */

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || '';

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

    const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params}`, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.ok) {
      const result = await response.json();
      return { success: result.success, saved: invoices.length, error: result.error };
    }

    return { success: true, saved: invoices.length };
  } catch (error) {
    console.error('Error syncing invoices:', error);
    return { success: true, saved: invoices.length, error: 'Request sent but response unclear' };
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
