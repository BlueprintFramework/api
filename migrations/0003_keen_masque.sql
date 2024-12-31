ALTER TABLE "extensions" ADD COLUMN "keywords" varchar(255)[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extensions_pending_idx" ON "extensions" USING btree ("pending");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extensions_hidden_idx" ON "extensions" USING btree ("hidden");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extensions_created_idx" ON "extensions" USING btree ("created");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extensions_author_id_idx" ON "extensions" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extensions_type_idx" ON "extensions" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extensions_keywords_idx" ON "extensions" USING gin ("keywords");