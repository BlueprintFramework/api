TRUNCATE "telemetry_data", "telemetry_panels" CASCADE;--> statement-breakpoint
ALTER TABLE "telemetry_data" ALTER COLUMN "panel_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "telemetry_data" ALTER COLUMN "data" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "telemetry_panels" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "telemetry_data" ADD COLUMN "telemetry_version" smallint NOT NULL;--> statement-breakpoint
ALTER TABLE "telemetry_panels" ADD COLUMN "last_update" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "telemetry_panels" DROP COLUMN IF EXISTS "version";