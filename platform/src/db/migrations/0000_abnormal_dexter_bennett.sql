CREATE TABLE "config_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_kv" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"type" text DEFAULT 'string' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" text NOT NULL,
	"date_received" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"event_date" text DEFAULT '' NOT NULL,
	"event_time" text DEFAULT '' NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"package_name" text DEFAULT '' NOT NULL,
	"song_requests" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"quotation_number" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"document_type" text DEFAULT 'quotation' NOT NULL,
	"status" text DEFAULT 'quotation_draft' NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"client_phone" text DEFAULT '' NOT NULL,
	"client_email" text DEFAULT '' NOT NULL,
	"client_address" text DEFAULT '' NOT NULL,
	"event_type" text DEFAULT '' NOT NULL,
	"event_date" text DEFAULT '' NOT NULL,
	"event_time_hour" text DEFAULT '7' NOT NULL,
	"event_time_minute" text DEFAULT '00' NOT NULL,
	"event_time_period" text DEFAULT 'PM' NOT NULL,
	"event_venue" text DEFAULT '' NOT NULL,
	"geo_location" text DEFAULT '' NOT NULL,
	"lead_source" text DEFAULT '' NOT NULL,
	"collaboration_partner" text DEFAULT '' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"discount_type" text DEFAULT 'amount' NOT NULL,
	"deposit_requested" double precision DEFAULT 0 NOT NULL,
	"deposit_paid" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"payment_status" text DEFAULT 'none' NOT NULL,
	"deposit_received_date" text DEFAULT '' NOT NULL,
	"balance_received_date" text DEFAULT '' NOT NULL,
	"calendar_created" boolean DEFAULT false NOT NULL,
	"calendar_event_id" text DEFAULT '' NOT NULL,
	"invoice_sent_date" text DEFAULT '' NOT NULL,
	"receipt_sent_date" text DEFAULT '' NOT NULL,
	"event_completed_date" text DEFAULT '' NOT NULL,
	"feedback_status" text DEFAULT 'pending' NOT NULL,
	"linked_quotation_number" text DEFAULT '' NOT NULL,
	"converted_at" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "config_history_year_idx" ON "config_history" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiries_inquiry_id_idx" ON "inquiries" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "inquiries_event_date_idx" ON "inquiries" USING btree ("event_date");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_event_date_idx" ON "invoices" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_deleted_at_idx" ON "invoices" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "invoices_document_type_idx" ON "invoices" USING btree ("document_type");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_phone_idx" ON "subscribers" USING btree ("phone");