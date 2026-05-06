CREATE TABLE "songs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"category" text NOT NULL,
	"language" text NOT NULL,
	"popularity" integer DEFAULT 3 NOT NULL,
	"mood" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "song_selections" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "songs_category_idx" ON "songs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "songs_active_idx" ON "songs" USING btree ("is_active");