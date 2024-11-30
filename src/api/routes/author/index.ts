import { authorAPIRouter } from "@/api"
import { and, count, eq } from "drizzle-orm"

export = new authorAPIRouter.Path('/')
	.http('GET', '/', (http) => http
		.document({
			description: 'Get the current author information',
			responses: {
				200: {
					description: 'Success',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									author: {
										$ref: '#/components/schemas/Author'
									}, extensions: {
										type: 'object',
										properties: {
											pending: {
												type: 'integer'
											}, approved: {
												type: 'integer'
											}
										}, required: ['pending', 'approved']
									}
								}, required: ['author', 'extensions']
							}
						}
					}
				}
			}
		})
		.onRequest(async(ctr) => {
			const [ pending, approved ] = await ctr["@"].cache.use(`author::${ctr["@"].author.id}::extension_stats`, () => Promise.all([
				ctr["@"].database.select({
					extensions: count()
				})
					.from(ctr["@"].database.schema.extensions)
					.where(and(
						eq(ctr["@"].database.schema.extensions.authorId, ctr["@"].author.id),
						eq(ctr["@"].database.schema.extensions.pending, true)
					))
					.then((r) => r[0].extensions || 0),
				ctr["@"].database.select({
					extensions: count()
				})
					.from(ctr["@"].database.schema.extensions)
					.where(and(
						eq(ctr["@"].database.schema.extensions.authorId, ctr["@"].author.id),
						eq(ctr["@"].database.schema.extensions.pending, false)
					))
					.then((r) => r[0].extensions || 0)
			]))

			return ctr.print({
				author: ctr["@"].author,
				extensions: {
					pending,
					approved
				}
			})
		})
	)