import database from "@/globals/database"
import logger from "@/globals/logger"
import { network, string, time } from "@rjweb/utils"
import * as schema from "@/schema"
import { lookup } from "@/globals/ip"
import cache from "@/globals/cache"

export type Telemetry = {
	panelId: string
	version: string
	data: string
	ip: string

	continent: string | null
	country: string | null
}

const processing: Telemetry[] = []

/**
 * Log a new Telemetry
 * @since 1.0.0
*/ export function log(panelId: string, version: string, data: string, ip: network.IPAddress): Telemetry {
	const telemetry: Telemetry = {
		panelId, version, data,
		ip: ip.usual(),
		continent: null,
		country: null
	}

	processing.push(telemetry)

	return telemetry
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
		}

		const panels = new Set(telemetry.map((t) => t.panelId))
		
		await Promise.all(Array.from(panels).map((id) => cache.use(`panel:${id}`, () => database.insert(schema.telemetryPanels)
			.values({ id, version: telemetry.find((t) => t.panelId === id)!.version })
			.onConflictDoUpdate({
				target: schema.telemetryPanels.id,
				set: {
					version: telemetry.find((t) => t.panelId === id)!.version
				}
			})
		)))

		await database.insert(schema.telemetryData)
			.values(telemetry.map((t) => Object.assign(t, { ip: string.hash(t.ip, { algorithm: 'sha256' }) })))
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