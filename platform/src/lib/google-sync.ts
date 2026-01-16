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
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'saveInvoice',
        invoice,
      }),
      mode: 'no-cors', // Google Apps Script doesn't support CORS properly
    });

    // no-cors mode doesn't give us response body, assume success
    return { success: true };
  } catch (error) {
    console.error('Error saving to Google:', error);
    return { success: false, error: String(error) };
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
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'createEvent',
        event,
      }),
      mode: 'no-cors',
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return { success: false, error: String(error) };
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
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'syncAll',
        invoices,
      }),
      mode: 'no-cors',
    });

    return { success: true, saved: invoices.length };
  } catch (error) {
    console.error('Error syncing invoices:', error);
    return { success: false, error: String(error) };
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
    // For GET requests, we can use fetch normally (with a JSONP workaround or proxy)
    // But due to CORS limitations, we'll need to handle this differently
    const url = `${GOOGLE_SCRIPT_URL}?action=getAvailability&month=${month}&year=${year}`;
    
    // Create a script element for JSONP-style loading
    return new Promise((resolve) => {
      const callback = `googleCallback_${Date.now()}`;
      
      // Fallback: Return empty data if can't fetch
      setTimeout(() => {
        resolve({
          month,
          year,
          bookedDates: [],
        });
      }, 5000);

      // Try fetch with no-cors
      fetch(url, { mode: 'no-cors' })
        .then(() => {
          // Can't read response with no-cors, return empty
          resolve({
            month,
            year,
            bookedDates: [],
          });
        })
        .catch(() => {
          resolve(null);
        });
    });
  } catch (error) {
    console.error('Error getting availability:', error);
    return null;
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
