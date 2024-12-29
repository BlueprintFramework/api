import { globalAPIRouter } from "@/api"
import { time } from "@rjweb/utils"
import { and, eq, or, sql } from "drizzle-orm"

export = new globalAPIRouter.Path('/')
	.http('GET', '/', (http) => http
		.document({
			description: 'Get a blueprint extension',
			responses: {
				200: {
					description: 'Success',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/Extension'
							}
						}
					}
				}
			}, parameters: [
				{
					name: 'id',
					in: 'path',
					description: 'The ID or identifier of the extension',
					required: true,
					schema: {
						anyOf: [
							{ type: 'integer' },
							{ type: 'string' }
						]
					}
				}
			]
		})
		.onRequest(async(ctr) => {
			const id = ctr.params.get('id', '')
			if (!id) return ctr.status(ctr.$status.BAD_REQUEST).print({ errors: ['Invalid ID'] })

			const idInt = parseInt(id)

			const [ extension ] = await ctr["@"].cache.use(`extension::${id}`, () => ctr["@"].database.select(ctr["@"].database.fields.extension)
					.from(ctr["@"].database.schema.extensions)
					.innerJoin(ctr["@"].database.schema.authors, eq(ctr["@"].database.schema.extensions.authorId, ctr["@"].database.schema.authors.id))
					.where(and(
						eq(ctr["@"].database.schema.extensions.hidden, false),
						or(
							!isNaN(idInt) ? eq(ctr["@"].database.schema.extensions.id, idInt) : undefined,
							eq(ctr["@"].database.schema.extensions.identifier, id)
						)
					)),
				time(5).m()
			)

			if (!extension) return ctr.status(ctr.$status.NOT_FOUND).print({ errors: ['Extension not found'] })

			return ctr.print(extension)
		})
	)