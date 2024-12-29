import { globalAPIRouter } from "@/api"
import { time } from "@rjweb/utils"
import { and, desc, eq, inArray, or, sql } from "drizzle-orm"

export = new globalAPIRouter.Path('/')
	.http('GET', '/', (http) => http
		.document({
			description: 'Get the install-base of a blueprint extensions versions',
			responses: {
				200: {
					description: 'Success',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								additionalProperties: {
									type: 'number'
								}
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

			const versionStats = await ctr["@"].cache.use(`versions::${extension.id}`, () => ctr["@"].database.select({
					version: sql<string>`ext->>'version'`.as('version'),
					percentage: sql<number>`(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::numeric(5,2)`.mapWith(Number).as('percentage')
				})
					.from(
						ctr["@"].database.select({
							ext: sql`jsonb_array_elements(data->'blueprint'->'extensions')`.as('ext')
						})
						.from(ctr["@"].database.schema.telemetryData)
						.where(and(
							inArray(
								ctr["@"].database.schema.telemetryData.id,
								ctr["@"].database.select({ id: ctr["@"].database.schema.telemetryPanelsWithLatest.latest.latestTelemetryDataId })
									.from(ctr["@"].database.schema.telemetryPanelsWithLatest)
							),
							sql`created > NOW() - INTERVAL '2 days'`
						))
						.as('subq')
					)
					.where(sql`ext->>'identifier' = ${extension.identifier}`)
					.groupBy(sql`ext->>'version'`)
					.orderBy(desc(sql`percentage`)),
				time(5).m()
			)

			return ctr.print(Object.fromEntries(versionStats.map((stat) => [
				stat.version,
				stat.percentage
			])))
		})
	)