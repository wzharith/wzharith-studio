/**
 * Catalog of GET routes safe to probe from the dashboard (read-only smoke tests).
 * Mutating routes (POST/PATCH/DELETE) are intentionally omitted.
 */
export type ReadOnlyApiEndpoint = {
  id: string;
  label: string;
  path: string;
  /** Query string including leading `?`, or omit */
  query?: string;
  /** none = callable without session; session = expects auth cookie */
  auth: 'none' | 'session';
  description?: string;
};

export const READ_ONLY_API_ENDPOINTS: ReadOnlyApiEndpoint[] = [
  {
    id: 'songs',
    label: 'Songs',
    path: '/api/songs',
    auth: 'none',
    description: 'Public repertoire catalog',
  },
  {
    id: 'config',
    label: 'Config',
    path: '/api/config',
    auth: 'none',
    description: 'Merged site config (KV)',
  },
  {
    id: 'auth-status',
    label: 'Auth status',
    path: '/api/auth/status',
    auth: 'none',
    description: 'Whether session cookie is present',
  },
  {
    id: 'calendar-availability',
    label: 'Calendar availability',
    path: '/api/calendar/availability',
    auth: 'none',
    description: 'Booked dates — query uses dashboard calendar month',
  },
  {
    id: 'calendar-events',
    label: 'Calendar events',
    path: '/api/calendar/events',
    auth: 'none',
    description: 'Performance events from Google Calendar (if configured)',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    path: '/api/invoices',
    auth: 'session',
    description: 'All invoices (requires login)',
  },
  {
    id: 'latest-number',
    label: 'Latest invoice numbers',
    path: '/api/invoices/latest-number',
    auth: 'session',
    description: 'Next QUO / INV sequence for current year',
  },
  {
    id: 'inquiries',
    label: 'Inquiries',
    path: '/api/inquiries',
    auth: 'session',
    description: 'Booking form submissions',
  },
  {
    id: 'config-history',
    label: 'Config history',
    path: '/api/config/history',
    auth: 'session',
    description: 'Archived yearly snapshots',
  },
];
