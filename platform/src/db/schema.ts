import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  uuid,
  jsonb,
  doublePrecision,
  boolean,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceNumber: text('invoice_number').notNull(),
    documentType: text('document_type').notNull().default('quotation'),
    status: text('status').notNull().default('quotation_draft'),

    clientName: text('client_name').default('').notNull(),
    clientPhone: text('client_phone').default('').notNull(),
    clientEmail: text('client_email').default('').notNull(),
    clientAddress: text('client_address').default('').notNull(),

    eventType: text('event_type').default('').notNull(),
    eventDate: text('event_date').default('').notNull(),
    eventTimeHour: text('event_time_hour').default('7').notNull(),
    eventTimeMinute: text('event_time_minute').default('00').notNull(),
    eventTimePeriod: text('event_time_period').default('PM').notNull(),
    eventVenue: text('event_venue').default('').notNull(),
    geoLocation: text('geo_location').default('').notNull(),

    leadSource: text('lead_source').default('').notNull(),
    collaborationPartner: text('collaboration_partner').default('').notNull(),

    items: jsonb('items').$type<unknown[]>().default([]).notNull(),
    discount: doublePrecision('discount').default(0).notNull(),
    discountType: text('discount_type').default('amount').notNull(),

    depositRequested: doublePrecision('deposit_requested').default(0).notNull(),
    depositPaid: doublePrecision('deposit_paid').default(0).notNull(),
    total: doublePrecision('total').default(0).notNull(),

    paymentStatus: text('payment_status').default('none').notNull(),
    depositReceivedDate: text('deposit_received_date').default('').notNull(),
    balanceReceivedDate: text('balance_received_date').default('').notNull(),

    calendarCreated: boolean('calendar_created').default(false).notNull(),
    calendarEventId: text('calendar_event_id').default('').notNull(),

    invoiceSentDate: text('invoice_sent_date').default('').notNull(),
    receiptSentDate: text('receipt_sent_date').default('').notNull(),
    eventCompletedDate: text('event_completed_date').default('').notNull(),
    feedbackStatus: text('feedback_status').default('pending').notNull(),

    linkedQuotationNumber: text('linked_quotation_number').default('').notNull(),
    convertedAt: text('converted_at').default('').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    invoiceNumberIdx: uniqueIndex('invoices_invoice_number_idx').on(t.invoiceNumber),
    eventDateIdx: index('invoices_event_date_idx').on(t.eventDate),
    statusIdx: index('invoices_status_idx').on(t.status),
    deletedAtIdx: index('invoices_deleted_at_idx').on(t.deletedAt),
    documentTypeIdx: index('invoices_document_type_idx').on(t.documentType),
  })
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export const configKv = pgTable('config_kv', {
  key: text('key').primaryKey(),
  value: jsonb('value'),
  type: text('type').default('string').notNull(),
  description: text('description').default('').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export type ConfigKv = typeof configKv.$inferSelect;
export type NewConfigKv = typeof configKv.$inferInsert;

export const configHistory = pgTable(
  'config_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    year: integer('year').notNull(),
    snapshot: jsonb('snapshot').$type<{
      packages?: unknown[];
      addons?: unknown[];
      businessInfo?: Record<string, unknown>;
    }>().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    notes: text('notes').default('').notNull(),
  },
  (t) => ({
    yearIdx: uniqueIndex('config_history_year_idx').on(t.year),
  })
);

export type ConfigHistoryRow = typeof configHistory.$inferSelect;

export const inquiries = pgTable(
  'inquiries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inquiryId: text('inquiry_id').notNull(),
    dateReceived: timestamp('date_received', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    name: text('name').default('').notNull(),
    email: text('email').default('').notNull(),
    phone: text('phone').default('').notNull(),
    eventDate: text('event_date').default('').notNull(),
    eventTime: text('event_time').default('').notNull(),
    venue: text('venue').default('').notNull(),
    packageName: text('package_name').default('').notNull(),
    songRequests: text('song_requests').default('').notNull(),
    message: text('message').default('').notNull(),
    status: text('status').default('new').notNull(),
    quotationNumber: text('quotation_number').default('').notNull(),
    notes: text('notes').default('').notNull(),
  },
  (t) => ({
    inquiryIdIdx: uniqueIndex('inquiries_inquiry_id_idx').on(t.inquiryId),
    eventDateIdx: index('inquiries_event_date_idx').on(t.eventDate),
  })
);

export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;

export const subscribers = pgTable(
  'subscribers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: text('phone').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => ({
    phoneIdx: uniqueIndex('subscribers_phone_idx').on(t.phone),
  })
);

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').default('').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});
