import database from "@/globals/database"
import logger from "@/globals/logger"
import { network, object, string, time } from "@rjweb/utils"
import * as schema from "@/schema"
import { lookup } from "@/globals/ip"
import cache from "@/globals/cache"
import { z } from "zod"

export const telemetrySchema = z.object({
	id: z.string().uuid(),
	telemetry_version: z.literal(1),

	blueprint: z.object({
		version: z.string().max(31),
		docker: z.boolean(),

		flags: z.object({
			disable_attribution: z.boolean(),
			is_developer: z.boolean(),
			show_in_sidebar: z.boolean()
		}),

		extensions: z.object({
			identifier: z.string(),
			version: z.string(),
			target: z.string()
		}).array()
	}),

	panel: z.object({
		version: z.string().max(31),
		phpVersion: z.string().max(31),

		drivers: z.object({
			backup: z.object({
				type: z.string().max(31)
			}),

			cache: z.object({
				type: z.string().max(31)
			}),

			database: z.object({
				type: z.string().max(31),
				version: z.string().max(255)
			})
		})
	})
})

export type Telemetry =  {
	panelId: string
	telemetryVersion: number
	ip: string
	continent: string | null
	country: string | null
	data: Pick<z.infer<typeof telemetrySchema>, 'blueprint' | 'panel'>
	created: Date
}

const processing: Telemetry[] = []

/**
 * Log a new Telemetry
 * @since 1.0.0
*/ export function log(ip: network.IPAddress, telemetry: z.infer<typeof telemetrySchema>): Telemetry {
	const data: Telemetry = {
		panelId: telemetry.id,
		telemetryVersion: telemetry.telemetry_version,
		ip: ip.usual(),
		continent: null,
		country: null,
		data: object.pick(telemetry, ['blueprint', 'panel']),
		created: new Date()
	}

	processing.push(data)

	return data
}

const process = async(): Promise<void> => {
	const telemetry = processing.splice(0, 30)
	if (!telemetry.length) return

	try {
		const ips = await lookup(telemetry.map((r) => r.ip)).catch(() => null)

		for (const t of telemetry) {
			const ip = ips?.find((ip) => ip.query === t.ip)
			if (ip) {
				t.continent = ip.continent
				t.country = ip.country
			}

			t.ip = string.hash(t.ip, { algorithm: 'sha256' })
		}

		const panels = new Set(telemetry.map((t) => t.panelId))
		
		await Promise.all(Array.from(panels).map((id) => cache.use(`panel:${id}`, () => database.write.insert(schema.telemetryPanels)
			.values({ id })
			.onConflictDoUpdate({
				target: schema.telemetryPanels.id,
				set: { lastUpdate: telemetry.filter((t) => t.panelId === id).sort((a, b) => b.created.getTime() - a.created.getTime())[0].created }
			})
		)))

		await database.write.insert(schema.telemetryData)
			.values(telemetry)
			.onConflictDoNothing()
	} catch (err) {
		processing.push(...telemetry)
		throw err
	}

	logger()
		.text('Processed')
		.text(telemetry.length, (c) => c.cyan)
		.text('Telemetry')
		.info()
}

setInterval(() => {
	process()
		.catch((err: unknown) => {
			logger()
				.text('Failed to process Telemetry', (c) => c.red)
				.text('\n')
				.text(String(err && typeof err === 'object' && 'stack' in err ? err.stack : err), (c) => c.red)
				.error()
		})
}, time(5).s())