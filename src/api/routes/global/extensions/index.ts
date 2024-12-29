import { globalAPIRouter } from "@/api"
import { time } from "@rjweb/utils"
import { asc, eq, sql } from "drizzle-orm"

export = new globalAPIRouter.Path('/')
	.http('GET', '/', (http) => http
		.document({
			description: 'Get all blueprint extensions',
			responses: {
				200: {
					description: 'Success',
					content: {
						'application/json': {
							schema: {
								type: 'array',
								items: {
									$ref: '#/components/schemas/Extension'
								}
							}
						}
					}
				}
			}
		})
		.onRequest(async(ctr) => {
			const extensions = await ctr["@"].cache.use('extensions::all', () => ctr["@"].database.select(ctr["@"].database.fields.extension)
					.from(ctr["@"].database.schema.extensions)
					.innerJoin(ctr["@"].database.schema.authors, eq(ctr["@"].database.schema.extensions.authorId, ctr["@"].database.schema.authors.id))
					.where(eq(ctr["@"].database.schema.extensions.hidden, false))
					.orderBy(asc(ctr["@"].database.schema.extensions.id)),
				time(5).m()
			)

			return ctr.print(extensions)
		})
	)