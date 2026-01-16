/**
 * WZHarith Studio - Google Apps Script Backend
 *
 * This script handles:
 * 1. Storing invoices/quotations in Google Sheets
 * 2. Managing events in Google Calendar
 * 3. Creating reminders (song confirmation, balance due)
 * 4. Providing availability data
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Apps Script project at script.google.com
 * 2. Copy this entire code into the script editor
 * 3. Update the SHEET_ID and CALENDAR_ID constants below
 * 4. Deploy as Web App (Execute as: Me, Who has access: Anyone)
 * 5. Copy the Web App URL to your .env.local as NEXT_PUBLIC_GOOGLE_SCRIPT_URL
 */

// =============================================================================
// CONFIGURATION - UPDATE THESE VALUES
// =============================================================================

// Google Sheet ID (from the URL: docs.google.com/spreadsheets/d/SHEET_ID/edit)
const SHEET_ID = 'YOUR_SHEET_ID_HERE';

// Google Calendar ID (usually your email for primary calendar)
const CALENDAR_ID = 'YOUR_CALENDAR_ID_HERE';

// Reminder settings (days before event)
const SONG_CONFIRMATION_DAYS = 14;
const BALANCE_REMINDER_DAYS = 3;

// Sheet names
const SHEETS = {
  INVOICES: 'Invoices',
  INQUIRIES: 'Inquiries',
  EVENTS: 'Events',
  CONFIG: 'Config',
};

// =============================================================================
// WEB APP ENTRY POINT
// =============================================================================

/**
 * Handle GET requests (for availability checking)
 */
function doGet(e) {
  const action = e.parameter.action;

  try {
    let result;

    switch (action) {
      case 'getAvailability':
        result = getAvailability(e.parameter.month, e.parameter.year);
        break;
      case 'getEvents':
        result = getEvents();
        break;
      case 'getInvoices':
        result = getInvoices();
        break;
      default:
        result = { error: 'Unknown action' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests (for saving data)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    let result;

    switch (action) {
      case 'saveInvoice':
        result = saveInvoice(data.invoice);
        break;
      case 'createEvent':
        result = createCalendarEvent(data.event);
        break;
      case 'updateInvoiceStatus':
        result = updateInvoiceStatus(data.invoiceNumber, data.status);
        break;
      case 'syncAll':
        result = syncAllInvoices(data.invoices);
        break;
      case 'saveBookingInquiry':
        result = saveBookingInquiry(data.inquiry);
        break;
      default:
        result = { error: 'Unknown action' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =============================================================================
// INVOICE MANAGEMENT
// =============================================================================

/**
 * Save or update an invoice in Google Sheets
 */
function saveInvoice(invoice) {
  const sheet = getOrCreateSheet(SHEETS.INVOICES, [
    'Invoice Number',
    'Document Type',
    'Status',
    'Client Name',
    'Client Phone',
    'Client Email',
    'Client Address',
    'Event Type',
    'Event Date',
    'Event Time',
    'Venue',
    'Subtotal',
    'Discount',
    'Total',
    'Deposit Paid',
    'Balance Due',
    'Items JSON',
    'Created At',
    'Updated At',
    'Linked Quotation',
  ]);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const invoiceNumCol = headers.indexOf('Invoice Number');

  // Find existing row
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][invoiceNumCol] === invoice.invoiceNumber) {
      rowIndex = i + 1; // Sheet rows are 1-indexed
      break;
    }
  }

  const eventTime = `${invoice.eventTimeHour}:${invoice.eventTimeMinute} ${invoice.eventTimePeriod}`;

  const rowData = [
    invoice.invoiceNumber,
    invoice.documentType,
    invoice.status || 'draft',
    invoice.clientName,
    invoice.clientPhone,
    invoice.clientEmail,
    invoice.clientAddress || '',
    invoice.eventType,
    invoice.eventDate,
    eventTime,
    invoice.eventVenue,
    calculateSubtotal(invoice.items),
    invoice.discount || 0,
    invoice.total,
    invoice.depositPaid || 0,
    invoice.total - (invoice.depositPaid || 0),
    JSON.stringify(invoice.items),
    invoice.createdAt || new Date().toISOString(),
    new Date().toISOString(),
    invoice.linkedQuotationNumber || '',
  ];

  if (rowIndex > 0) {
    // Update existing
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // Append new
    sheet.appendRow(rowData);
  }

  return { success: true, invoiceNumber: invoice.invoiceNumber };
}

/**
 * Sync all invoices from client (batch update)
 */
function syncAllInvoices(invoices) {
  let saved = 0;
  let errors = [];

  for (const invoice of invoices) {
    try {
      saveInvoice(invoice);
      saved++;
    } catch (e) {
      errors.push({ invoiceNumber: invoice.invoiceNumber, error: e.message });
    }
  }

  return { success: true, saved, errors };
}

/**
 * Save a booking inquiry from the website form
 * Also creates a draft quotation automatically
 */
function saveBookingInquiry(inquiry) {
  // Save to Inquiries sheet
  const sheet = getOrCreateSheet(SHEETS.INQUIRIES, [
    'Inquiry ID',
    'Date Received',
    'Name',
    'Email',
    'Phone',
    'Event Date',
    'Event Time',
    'Venue',
    'Package',
    'Song Requests',
    'Message',
    'Status',
    'Quotation Number',
    'Notes',
  ]);

  const inquiryId = 'INQ-' + new Date().getTime();
  const quotationNumber = generateNextQuotationNumber();

  const rowData = [
    inquiryId,
    new Date().toISOString(),
    inquiry.name,
    inquiry.email,
    inquiry.phone,
    inquiry.eventDate,
    inquiry.eventTime,
    inquiry.venue,
    inquiry.packageName || 'Not specified',
    inquiry.songRequests || '',
    inquiry.message || '',
    'new', // Status: new, contacted, quoted, booked, lost
    quotationNumber,
    '',
  ];

  sheet.appendRow(rowData);

  // Also create a draft invoice/quotation
  const draftInvoice = {
    invoiceNumber: quotationNumber,
    documentType: 'quotation',
    status: 'draft',
    clientName: inquiry.name,
    clientPhone: inquiry.phone,
    clientEmail: inquiry.email,
    clientAddress: '',
    eventType: 'Wedding Reception',
    eventDate: inquiry.eventDate,
    eventTimeHour: parseTimeHour(inquiry.eventTime),
    eventTimeMinute: parseTimeMinute(inquiry.eventTime),
    eventTimePeriod: parseTimePeriod(inquiry.eventTime),
    eventVenue: inquiry.venue,
    items: [],
    discount: 0,
    discountType: 'amount',
    depositPaid: 0,
    total: 0,
    createdAt: new Date().toISOString(),
  };

  // Add package if specified
  if (inquiry.packageId) {
    draftInvoice.items = [{
      id: '1',
      description: inquiry.packageName || 'Performance Package',
      details: 'As discussed',
      quantity: 1,
      rate: inquiry.packagePrice || 0,
    }];
    draftInvoice.total = inquiry.packagePrice || 0;
  }

  saveInvoice(draftInvoice);

  return {
    success: true,
    inquiryId: inquiryId,
    quotationNumber: quotationNumber,
  };
}

/**
 * Generate next quotation number
 */
function generateNextQuotationNumber() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.INVOICES);
  if (!sheet) {
    return 'QUO-' + new Date().getFullYear() + '-001';
  }

  const data = sheet.getDataRange().getValues();
  const year = new Date().getFullYear();
  const prefix = 'QUO-' + year + '-';

  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const invoiceNum = data[i][0];
    if (invoiceNum && invoiceNum.startsWith(prefix)) {
      const num = parseInt(invoiceNum.replace(prefix, ''));
      if (num > maxNum) maxNum = num;
    }
  }

  return prefix + String(maxNum + 1).padStart(3, '0');
}

/**
 * Parse time helpers
 */
function parseTimeHour(timeStr) {
  if (!timeStr) return '7';
  const match = timeStr.match(/(\d{1,2})/);
  if (!match) return '7';
  let hour = parseInt(match[1]);
  if (hour > 12) hour = hour - 12;
  return String(hour);
}

function parseTimeMinute(timeStr) {
  if (!timeStr) return '00';
  const match = timeStr.match(/:(\d{2})/);
  return match ? match[1] : '00';
}

function parseTimePeriod(timeStr) {
  if (!timeStr) return 'PM';
  if (timeStr.toLowerCase().includes('am')) return 'AM';
  const match = timeStr.match(/(\d{1,2})/);
  if (match) {
    const hour = parseInt(match[1]);
    if (hour >= 12 && hour < 24) return 'PM';
  }
  return 'PM';
}

/**
 * Get all invoices from sheet
 */
function getInvoices() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.INVOICES);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const invoices = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const invoice = {};
    headers.forEach((header, j) => {
      invoice[toCamelCase(header)] = row[j];
    });

    // Parse items JSON
    if (invoice.itemsJson) {
      try {
        invoice.items = JSON.parse(invoice.itemsJson);
      } catch (e) {
        invoice.items = [];
      }
    }

    invoices.push(invoice);
  }

  return invoices;
}

/**
 * Update invoice status
 */
function updateInvoiceStatus(invoiceNumber, status) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.INVOICES);
  if (!sheet) return { error: 'Sheet not found' };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const invoiceNumCol = headers.indexOf('Invoice Number');
  const statusCol = headers.indexOf('Status');
  const updatedCol = headers.indexOf('Updated At');

  for (let i = 1; i < data.length; i++) {
    if (data[i][invoiceNumCol] === invoiceNumber) {
      sheet.getRange(i + 1, statusCol + 1).setValue(status);
      sheet.getRange(i + 1, updatedCol + 1).setValue(new Date().toISOString());
      return { success: true };
    }
  }

  return { error: 'Invoice not found' };
}

// =============================================================================
// CALENDAR MANAGEMENT
// =============================================================================

/**
 * Create a calendar event with reminders
 */
function createCalendarEvent(eventData) {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) {
    return { error: 'Calendar not found. Check CALENDAR_ID.' };
  }

  // Parse event date and time
  const eventDate = new Date(eventData.eventDate);
  const [hours, minutes] = parseTime(eventData.eventTime);
  eventDate.setHours(hours, minutes);

  // Create end time (2 hours after start by default)
  const endDate = new Date(eventDate);
  endDate.setHours(endDate.getHours() + 2);

  // Event title and description
  const title = `🎷 ${eventData.clientName} - ${eventData.eventType}`;
  const description = `
Client: ${eventData.clientName}
Phone: ${eventData.clientPhone}
Email: ${eventData.clientEmail}
Venue: ${eventData.venue}
Package: ${eventData.packageName || 'TBC'}
Total: RM ${eventData.total}
Invoice: ${eventData.invoiceNumber}

Notes: ${eventData.notes || 'None'}
  `.trim();

  // Check if event already exists
  const existingEvents = calendar.getEventsForDay(eventDate);
  for (const event of existingEvents) {
    if (event.getTitle().includes(eventData.clientName)) {
      // Update existing event
      event.setTitle(title);
      event.setDescription(description);
      event.setLocation(eventData.venue);
      return { success: true, eventId: event.getId(), updated: true };
    }
  }

  // Create new event
  const event = calendar.createEvent(title, eventDate, endDate, {
    description: description,
    location: eventData.venue,
  });

  // Add reminders
  event.addEmailReminder(SONG_CONFIRMATION_DAYS * 24 * 60); // Song confirmation
  event.addEmailReminder(BALANCE_REMINDER_DAYS * 24 * 60);  // Balance reminder
  event.addPopupReminder(60); // 1 hour before

  // Create separate reminder events
  createSongConfirmationReminder(calendar, eventData, eventDate);
  createBalanceReminder(calendar, eventData, eventDate);

  return { success: true, eventId: event.getId() };
}

/**
 * Create song confirmation reminder (14 days before)
 */
function createSongConfirmationReminder(calendar, eventData, eventDate) {
  const reminderDate = new Date(eventDate);
  reminderDate.setDate(reminderDate.getDate() - SONG_CONFIRMATION_DAYS);
  reminderDate.setHours(10, 0, 0); // 10 AM

  const title = `📋 Song Confirmation: ${eventData.clientName}`;
  const description = `
Confirm song list with client for ${eventData.eventType} on ${eventDate.toLocaleDateString()}

Client: ${eventData.clientName}
Phone: ${eventData.clientPhone}
Venue: ${eventData.venue}
  `.trim();

  const endDate = new Date(reminderDate);
  endDate.setHours(11, 0, 0);

  calendar.createEvent(title, reminderDate, endDate, {
    description: description,
  });
}

/**
 * Create balance payment reminder (3 days before)
 */
function createBalanceReminder(calendar, eventData, eventDate) {
  const reminderDate = new Date(eventDate);
  reminderDate.setDate(reminderDate.getDate() - BALANCE_REMINDER_DAYS);
  reminderDate.setHours(10, 0, 0);

  const balanceDue = eventData.total - (eventData.depositPaid || 0);

  const title = `💰 Balance Due: ${eventData.clientName} - RM ${balanceDue}`;
  const description = `
Balance payment reminder for ${eventData.eventType} on ${eventDate.toLocaleDateString()}

Client: ${eventData.clientName}
Phone: ${eventData.clientPhone}
Total: RM ${eventData.total}
Deposit Paid: RM ${eventData.depositPaid || 0}
Balance Due: RM ${balanceDue}
  `.trim();

  const endDate = new Date(reminderDate);
  endDate.setHours(11, 0, 0);

  calendar.createEvent(title, reminderDate, endDate, {
    description: description,
  });
}

/**
 * Get all events (for availability checking)
 */
function getEvents() {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) return [];

  // Get events for next 12 months
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  const events = calendar.getEvents(startDate, endDate);

  return events
    .filter(e => e.getTitle().includes('🎷')) // Only performance events
    .map(e => ({
      date: e.getStartTime().toISOString().split('T')[0],
      title: e.getTitle(),
      venue: e.getLocation(),
    }));
}

/**
 * Get availability for a specific month
 */
function getAvailability(month, year) {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) return { error: 'Calendar not found' };

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const events = calendar.getEvents(startDate, endDate);

  const bookedDates = events
    .filter(e => e.getTitle().includes('🎷'))
    .map(e => e.getStartTime().toISOString().split('T')[0]);

  return {
    month,
    year,
    bookedDates: [...new Set(bookedDates)], // Unique dates
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get or create a sheet with headers
 */
function getOrCreateSheet(sheetName, headers) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Calculate subtotal from items
 */
function calculateSubtotal(items) {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
}

/**
 * Parse time string to hours and minutes
 */
function parseTime(timeStr) {
  // Handle "7:00 PM" format
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return [19, 0]; // Default 7 PM

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return [hours, minutes];
}

/**
 * Convert header to camelCase
 */
function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
}

// =============================================================================
// TESTING FUNCTIONS
// =============================================================================

/**
 * Test function - run this to verify setup
 */
function testSetup() {
  Logger.log('Testing Google Apps Script setup...');

  // Test Sheet access
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    Logger.log('✅ Sheet access OK: ' + ss.getName());
  } catch (e) {
    Logger.log('❌ Sheet access FAILED: ' + e.message);
  }

  // Test Calendar access
  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (calendar) {
      Logger.log('✅ Calendar access OK: ' + calendar.getName());
    } else {
      Logger.log('❌ Calendar not found. Check CALENDAR_ID.');
    }
  } catch (e) {
    Logger.log('❌ Calendar access FAILED: ' + e.message);
  }

  Logger.log('Test complete!');
}
