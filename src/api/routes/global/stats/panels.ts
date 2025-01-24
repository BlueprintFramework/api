import { globalAPIRouter } from "@/api"
import { number, time } from "@rjweb/utils"
import { and, avg, count, inArray, max, sql, sum } from "drizzle-orm"

export = new globalAPIRouter.Path('/')
	.http('GET', '/', (http) => http
		.document({
			description: 'Get the share of various blueprint panel stats',
			responses: {
				200: {
					description: 'Success',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									total: {
										type: 'integer'
									}, docker: {
										type: 'integer'
									}, standalone: {
										type: 'integer'
									},

									extensions: {
										type: 'object',
										properties: {
											total: {
												type: 'integer'
											}, max: {
												type: 'integer'
											}, average: {
												type: 'number'
											}
										}, required: ['total', 'max', 'average']
									}
								}, required: ['total', 'docker', 'extensions']
							}
						}
					}
				}
			}
		})
		.onRequest(async(ctr) => {
			const [ stats ] = await ctr["@"].cache.use('stats::all', () => ctr["@"].database.select({
					totalPanels: count(),
					dockerPanels: sum(sql`(data->'blueprint'->>'docker')::boolean::int`).mapWith(Number),
					sumExtensions: sum(sql`jsonb_array_length(data->'blueprint'->'extensions')`).mapWith(Number),
					maxExtensions: max(sql`jsonb_array_length(data->'blueprint'->'extensions')`).mapWith(Number),
					avgExtensions: avg(sql`jsonb_array_length(data->'blueprint'->'extensions')`).mapWith(Number)
				})
					.from(ctr["@"].database.schema.telemetryData)
					.where(and(
						inArray(
							ctr["@"].database.schema.telemetryData.id,
							ctr["@"].database.select({ id: ctr["@"].database.schema.telemetryPanelsWithLatest.latest.latestTelemetryDataId })
								.from(ctr["@"].database.schema.telemetryPanelsWithLatest)
						),
						sql`created > NOW() - INTERVAL '2 days'`
					)),
				time(5).m()
			)

			return ctr.print({
				total: stats.totalPanels,
				docker: stats.dockerPanels,
				standalone: stats.totalPanels - stats.dockerPanels,
				extensions: {
					total: stats.sumExtensions,
					max: stats.maxExtensions,
					average: number.round(stats.avgExtensions, 2)
				}
			})
		})
	)