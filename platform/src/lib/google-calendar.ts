import 'server-only';
import { google, type calendar_v3 } from 'googleapis';

let cachedClient: calendar_v3.Calendar | null = null;

export const PERFORMANCE_TITLE_PREFIX = '\u{1F3B7} '; // 🎷
const SONG_CONFIRMATION_DAYS = 14;
const BALANCE_REMINDER_DAYS = 3;

function readPrivateKey(): string {
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY ||
    '';
  if (!raw) return '';
  // Vercel often stores newlines as literal "\n" in env values.
  return raw.replace(/\\n/g, '\n');
}

export function isCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      readPrivateKey()
  );
}

export function getCalendarClient(): calendar_v3.Calendar {
  if (cachedClient) return cachedClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = readPrivateKey();
  if (!email || !key) {
    throw new Error(
      'Google Calendar API not configured. Set GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.'
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  cachedClient = google.calendar({ version: 'v3', auth });
  return cachedClient;
}

function getCalendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error('GOOGLE_CALENDAR_ID is not set');
  return id;
}

function isPerformanceEvent(title: string | null | undefined): boolean {
  if (!title) return false;
  return title.includes('\u{1F3B7}') || title.toLowerCase().includes('saxophone');
}

export interface AvailabilityResult {
  month: number;
  year: number;
  bookedDates: string[];
}

export async function getAvailability(month: number, year: number): Promise<AvailabilityResult> {
  const cal = getCalendarClient();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  const res = await cal.events.list({
    calendarId: getCalendarId(),
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });
  const items = res.data.items ?? [];
  const dates = items
    .filter((e) => isPerformanceEvent(e.summary))
    .map((e) => {
      const s = e.start?.dateTime || e.start?.date;
      if (!s) return null;
      return new Date(s).toISOString().split('T')[0];
    })
    .filter((d): d is string => Boolean(d));
  return {
    month,
    year,
    bookedDates: Array.from(new Set(dates)),
  };
}

export interface PerformanceEvent {
  date: string;
  title: string;
  venue: string;
}

export async function listPerformanceEvents(
  fromDate?: Date,
  toDate?: Date
): Promise<PerformanceEvent[]> {
  const cal = getCalendarClient();
  const start = fromDate ?? new Date();
  const end = toDate ?? new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  const res = await cal.events.list({
    calendarId: getCalendarId(),
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 1000,
  });
  const items = res.data.items ?? [];
  return items
    .filter((e) => isPerformanceEvent(e.summary))
    .map((e) => {
      const s = e.start?.dateTime || e.start?.date || '';
      return {
        date: new Date(s).toISOString().split('T')[0],
        title: e.summary ?? '',
        venue: e.location ?? '',
      };
    });
}

export interface CreateCalendarEventInput {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  eventType: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string; // "7:00 PM"
  venue: string;
  packageName?: string;
  total: number;
  depositPaid?: number;
  invoiceNumber: string;
  notes?: string;
}

function parseEventStart(dateStr: string, timeStr: string): Date {
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  let h = m ? parseInt(m[1], 10) : 19;
  const min = m ? parseInt(m[2], 10) : 0;
  const period = m?.[3]?.toUpperCase();
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const d = new Date(dateStr);
  d.setHours(h, min, 0, 0);
  return d;
}

export interface CreateCalendarEventResult {
  success: boolean;
  eventId?: string;
  updated?: boolean;
  error?: string;
}

export async function createOrUpdatePerformanceEvent(
  input: CreateCalendarEventInput
): Promise<CreateCalendarEventResult> {
  const cal = getCalendarClient();
  const calendarId = getCalendarId();

  const start = parseEventStart(input.eventDate, input.eventTime);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  const summary = `${PERFORMANCE_TITLE_PREFIX}${input.clientName} - ${input.eventType}`;
  const description = [
    `Client: ${input.clientName}`,
    `Phone: ${input.clientPhone}`,
    `Email: ${input.clientEmail}`,
    `Venue: ${input.venue}`,
    `Package: ${input.packageName || 'TBC'}`,
    `Total: RM ${input.total}`,
    `Invoice: ${input.invoiceNumber}`,
    '',
    `Notes: ${input.notes || 'None'}`,
  ].join('\n');

  // Look for an existing performance event matching the client name on the same day.
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setHours(23, 59, 59, 999);
  const existing = await cal.events.list({
    calendarId,
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    q: input.clientName,
    singleEvents: true,
    maxResults: 10,
  });

  const match = (existing.data.items ?? []).find(
    (e) => isPerformanceEvent(e.summary) && (e.summary ?? '').includes(input.clientName)
  );

  const requestBody: calendar_v3.Schema$Event = {
    summary,
    description,
    location: input.venue,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: SONG_CONFIRMATION_DAYS * 24 * 60 },
        { method: 'email', minutes: BALANCE_REMINDER_DAYS * 24 * 60 },
        { method: 'popup', minutes: 60 },
      ],
    },
  };

  if (match?.id) {
    const updated = await cal.events.update({
      calendarId,
      eventId: match.id,
      requestBody,
    });
    return { success: true, eventId: updated.data.id ?? match.id, updated: true };
  }

  const created = await cal.events.insert({
    calendarId,
    requestBody,
  });

  // Also drop the song-confirmation and balance-due reminder events on the calendar.
  await Promise.allSettled([
    createReminderEvent(cal, calendarId, start, SONG_CONFIRMATION_DAYS, {
      summary: `\u{1F4CB} Song Confirmation: ${input.clientName}`,
      description: [
        `Confirm song list with client for ${input.eventType} on ${start.toDateString()}`,
        '',
        `Client: ${input.clientName}`,
        `Phone: ${input.clientPhone}`,
        `Venue: ${input.venue}`,
      ].join('\n'),
    }),
    createReminderEvent(cal, calendarId, start, BALANCE_REMINDER_DAYS, {
      summary: `\u{1F4B0} Balance Due: ${input.clientName} - RM ${input.total - (input.depositPaid ?? 0)}`,
      description: [
        `Balance payment reminder for ${input.eventType} on ${start.toDateString()}`,
        '',
        `Client: ${input.clientName}`,
        `Phone: ${input.clientPhone}`,
        `Total: RM ${input.total}`,
        `Deposit Paid: RM ${input.depositPaid ?? 0}`,
        `Balance Due: RM ${input.total - (input.depositPaid ?? 0)}`,
      ].join('\n'),
    }),
  ]);

  return { success: true, eventId: created.data.id ?? undefined };
}

async function createReminderEvent(
  cal: calendar_v3.Calendar,
  calendarId: string,
  eventDate: Date,
  daysBefore: number,
  body: { summary: string; description: string }
) {
  const start = new Date(eventDate);
  start.setDate(start.getDate() - daysBefore);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(11, 0, 0, 0);
  await cal.events.insert({
    calendarId,
    requestBody: {
      summary: body.summary,
      description: body.description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });
}
