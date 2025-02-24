import { globalAPIRouter } from "@/api"
import { time } from "@rjweb/utils"
import { and, inArray, sql } from "drizzle-orm"

export = new globalAPIRouter.Path('/')
	.http('GET', '/', (http) => http
		.document({
			description: 'Get the share of blueprint flags in percentage',
			responses: {
				200: {
					description: 'Success',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								additionalProperties: {
									type: 'object',
									properties: {
										enabled: { type: 'number' },
										disabled: { type: 'number' }
									}, required: ['enabled', 'disabled']
								}
							}
						}
					}
				}
			}
		})
		.onRequest(async(ctr) => {
			const flagStats = await ctr["@"].cache.use('flags::all', () => ctr["@"].database.select({
					flagName: sql<string>`flag.key`.as('flagName'),
					percentageEnabled: sql<number>`
						(COUNT(*) * 100.0 / (
							SELECT COUNT(*)
							FROM ${ctr["@"].database.schema.telemetryData}
							WHERE id IN (
								SELECT ${ctr["@"].database.schema.telemetryPanelsWithLatest.latest.latestTelemetryDataId}
								FROM ${ctr["@"].database.schema.telemetryPanelsWithLatest}
							)
							AND created > NOW() - INTERVAL '2 days'
						))::numeric(5,2)
					`.mapWith(Number).as('percentageEnabled')
				})
					.from(ctr["@"].database.schema.telemetryData)
					.leftJoin(sql`LATERAL jsonb_each(data->'blueprint'->'flags') AS flag(key, value)`, sql`true`)
					.where(and(
						inArray(
							ctr["@"].database.schema.telemetryData.id,
							ctr["@"].database.select({ id: ctr["@"].database.schema.telemetryPanelsWithLatest.latest.latestTelemetryDataId })
								.from(ctr["@"].database.schema.telemetryPanelsWithLatest)
						),
						sql`created > NOW() - INTERVAL '2 days'`,
						sql`flag.value = 'true'`
					))
					.groupBy(sql`flag.key`),
				time(5).m()
			)

			return ctr.print(Object.fromEntries(flagStats.map((stat) => [
				stat.flagName,
				{
					enabled: stat.percentageEnabled,
					disabled: 100 - stat.percentageEnabled
				}
			])))
		})
	)