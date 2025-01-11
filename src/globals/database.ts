import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@/schema"
import env from "@/globals/env"
import logger from "@/globals/logger"
import { Pool } from "pg"
import { sql } from "drizzle-orm"

const pool = new Pool({
	connectionString: env.DATABASE_URL
})

const writePool = env.DATABASE_URL_PRIMARY ? new Pool({
	connectionString: env.DATABASE_URL_PRIMARY
}) : pool

const db = drizzle(pool, { schema }),
	writeDb = drizzle(writePool, { schema }),
	startTime = performance.now()

Promise.all([
	db.$client.connect(),
	env.DATABASE_URL_PRIMARY ? writeDb.$client.connect() : Promise.resolve()
]).then(() => {
	logger()
		.text('Database', (c) => c.cyan)
		.text('Connection established!')
		.text(`(${(performance.now() - startTime).toFixed(1)}ms)`, (c) => c.gray)
		.info()
})

type DbWithoutWrite = Omit<typeof db, 'insert' | 'update' | 'delete'>

export default Object.assign(db as DbWithoutWrite, {
	write: writeDb,
	schema,

	fields: Object.freeze({
		extension: Object.freeze({
			id: schema.extensions.id,
			type: schema.extensions.type,

			author: {
				id: schema.authors.id,
				name: schema.authors.name,
				website: schema.authors.website,
				support: schema.authors.support
			},

			name: schema.extensions.name,
			identifier: schema.extensions.identifier,
			summary: schema.extensions.summary,

			platforms: schema.extensions.platforms,
			keywords: schema.extensions.keywords,
			banner: schema.extensions.banner,

			created: schema.extensions.created,

			stats: Object.freeze({
				panels: sql<number>`(
					SELECT COUNT(*)
					FROM (
						SELECT jsonb_array_elements(data->'blueprint'->'extensions') as ext 
						FROM telemetry_data 
						WHERE id IN (
							SELECT latest_telemetry_data_id 
							FROM telemetry_panels_with_latest
						)
						AND created > NOW() - INTERVAL '2 days'
					) subq
					WHERE subq.ext->>'identifier' = ${schema.extensions.identifier}
				)`.mapWith(Number)
			})
		})
	})
})