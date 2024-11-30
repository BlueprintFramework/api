import { globalAPIRouter } from "@/api"
import { and, eq } from "drizzle-orm"

export = new globalAPIRouter.Path('/')
	.http('GET', '/', (http) => http
		.document({
			description: 'Get todays advent calendar reward',
			responses: {
				200: {
					description: 'Success',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									message: {
										type: 'string'
									}, extension: {
										$ref: '#/components/schemas/Extension'
									}
								}, required: ['message', 'extension']
							}
						}
					}
				}
			}
		})
		.onRequest(async(ctr) => {
			const year = new Date().getFullYear(),
				month = new Date().getMonth() + 1,
				day = new Date().getDate()

			if (month !== 12 || day > 25) return ctr.status(ctr.$status.NOT_FOUND).print({ errors: ['No advent calendar reward available'] })

			const advent = await ctr["@"].database.select({
				message: ctr["@"].database.schema.adventCalendar.message,
				...ctr["@"].database.fields.extension
			})
				.from(ctr["@"].database.schema.adventCalendar)
				.innerJoin(ctr["@"].database.schema.extensions, eq(ctr["@"].database.schema.adventCalendar.extensionId, ctr["@"].database.schema.extensions.id))
				.innerJoin(ctr["@"].database.schema.authors, eq(ctr["@"].database.schema.extensions.authorId, ctr["@"].database.schema.authors.id))
				.where(and(
					eq(ctr["@"].database.schema.adventCalendar.day, day),
					eq(ctr["@"].database.schema.adventCalendar.year, year)
				))
				.then((r) => r[0])

			if (!advent) return ctr.status(ctr.$status.NOT_FOUND).print({ errors: ['No advent calendar reward available'] })

			return ctr.print({
				message: advent.message,
				extension: Object.assign(advent, {
					message: undefined
				})
			})
		})
	)