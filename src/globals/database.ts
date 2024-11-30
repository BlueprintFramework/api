import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@/schema"
import env from "@/globals/env"
import logger from "@/globals/logger"
import { Pool } from "pg"

const pool = new Pool({
	connectionString: env.DATABASE_URL
})

const db = drizzle(pool, { schema }),
	startTime = performance.now()

db.$client.connect().then(() => {
	logger()
		.text('Database', (c) => c.cyan)
		.text('Connection established!')
		.text(`(${(performance.now() - startTime).toFixed(1)}ms)`, (c) => c.gray)
		.info()
})

export default Object.assign(db, {
	schema,

	fields: Object.freeze({
		extension: Object.freeze({
			id: schema.extensions.id,
			type: schema.extensions.type,

			author: {
				id: schema.authors.id,
				name: schema.authors.name,
				website: schema.authors.website
			},

			name: schema.extensions.name,
			identifier: schema.extensions.identifier,
			summary: schema.extensions.summary,
			platforms: schema.extensions.platforms,

			banner: schema.extensions.banner,

			created: schema.extensions.created
		})
	})
})