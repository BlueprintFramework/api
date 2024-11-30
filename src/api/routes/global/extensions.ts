import { globalAPIRouter } from "@/api"
import { asc, eq } from "drizzle-orm"

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
			const extensions = await ctr["@"].database.select(ctr["@"].database.fields.extension)
				.from(ctr["@"].database.schema.extensions)
				.innerJoin(ctr["@"].database.schema.authors, eq(ctr["@"].database.schema.extensions.authorId, ctr["@"].database.schema.authors.id))
				.where(eq(ctr["@"].database.schema.extensions.hidden, false))
				.orderBy(asc(ctr["@"].database.schema.extensions.id))

			return ctr.print(extensions)
		})
	)