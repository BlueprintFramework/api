DROP INDEX "extensions_name_idx";--> statement-breakpoint
CREATE INDEX "extensions_name_idx" ON "extensions" USING btree ("name");