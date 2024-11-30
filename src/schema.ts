import { sql } from "drizzle-orm"
import { integer, pgTable, varchar, uniqueIndex, pgEnum, serial, timestamp, jsonb, text, boolean, primaryKey, char, index } from "drizzle-orm/pg-core"

export const platforms = Object.freeze(['SOURCEXCHANGE', 'BUILTBYBIT', 'GITHUB'] as const)
export const currency = Object.freeze(['USD', 'EUR'] as const)

export type Platform = typeof platforms[number]
export type Currency = typeof currency[number]

export const extensionType = pgEnum('extension_type', ['THEME', 'EXTENSION'])

export const telemetryPanels = pgTable('telemetry_panels', {
	id: char('id', { length: 23 }).primaryKey().notNull(),
	version: varchar('version', { length: 31 }).notNull(),

	created: timestamp('created').notNull().default(sql`now()`)
})

export const telemetryData = pgTable('telemetry_data', {
	id: serial('id').primaryKey().notNull(),
	panelId: char('panel_id', { length: 23 }).notNull().references(() => telemetryPanels.id),

	data: varchar('data', { length: 255 }).notNull(),
	ip: char('ip', { length: 64 }).notNull(),

	continent: char('continent', { length: 2 }),
	country: char('country', { length: 2 }),

	created: timestamp('created').notNull().default(sql`now()`)
}, (telemetryData) => [
	index('telemetry_data_panel_id_idx').on(telemetryData.panelId),
	index('telemetry_data_data_idx').on(telemetryData.data),
	index('telemetry_data_ip_idx').on(telemetryData.ip),
	index('telemetry_data_continent_idx').on(telemetryData.continent),
	index('telemetry_data_country_idx').on(telemetryData.country),
	index('telemetry_data_created_idx').on(telemetryData.created)
])

export const authors = pgTable('authors', {
	id: serial('id').primaryKey().notNull(),

	name: varchar('name', { length: 255 }).notNull(),
	website: varchar('website', { length: 63 }),

	key: char('key', { length: 32 }).notNull().default(sql`md5(random()::text)`),

	created: timestamp('created').notNull().default(sql`now()`)
}, (authors) => [
	uniqueIndex('authors_name_idx').on(authors.name),
	uniqueIndex('authors_key_idx').on(authors.key)
])

export const extensions = pgTable('extensions', {
	id: serial('id').primaryKey().notNull(),
	authorId: integer('author_id').notNull().references(() => authors.id),

	type: extensionType('type').notNull(),
	hidden: boolean('hidden').default(false).notNull(),
	pending: boolean('pending').default(true).notNull(),

	name: varchar('name', { length: 255 }).notNull(),
	identifier: varchar('identifier', { length: 63 }).notNull(),
	summary: varchar('summary', { length: 255 }).notNull(),
	platforms: jsonb('platforms').notNull().$type<Record<Platform, { price: number, currency: Currency, url: string }>>(),

	banner: varchar('banner', { length: 255 }).notNull(),

	created: timestamp('created').notNull().default(sql`now()`)
}, (extensions) => [
	uniqueIndex('extensions_name_idx').on(extensions.name),
	uniqueIndex('extensions_identifier_idx').on(extensions.identifier)
])

export const adventCalendar = pgTable('advent_calendar', {
	extensionId: integer('extension_id').notNull().references(() => extensions.id),

	day: integer('day').notNull(),
	year: integer('year').notNull(),

	message: text('message').notNull()
}, (adventCalendar) => [
	primaryKey({ name: 'advent_calendar_pk', columns: [adventCalendar.day, adventCalendar.year] })
])