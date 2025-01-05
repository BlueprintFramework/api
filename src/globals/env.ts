import { filesystem } from "@rjweb/utils"
import { z } from "zod"

let env: Record<string, string | undefined>
try {
	env = filesystem.env('../.env', { async: false })
} catch {
	try {
		env = filesystem.env('../../.env', { async: false })
	} catch {
		env = process.env
	}
}

const base = z.object({
	DATABASE_URL: z.string(),
	DATABASE_URL_PRIMARY: z.string().optional(),
	SENTRY_URL: z.string().optional(),

	UPDATE_PRICES: z.enum(['true', 'false']).transform((str) => str === 'true'),

	PORT: z.string().transform((str) => parseInt(str)).optional(),
	RATELIMIT_PER_DAY: z.string().transform((str) => parseInt(str)).optional().default('2'),
	INTERNAL_KEY: z.string(),

	SXC_TOKEN: z.string().optional(),
	BBB_TOKEN: z.string().optional(),

	LOG_LEVEL: z.enum(['none', 'info', 'debug']),
	LOG_DIRECTORY: z.string().optional(),

	APP_URL: z.string(),
	SERVER_NAME: z.string().optional()
})

const infos = z.union([
	z.object({
		REDIS_MODE: z.literal('redis').default('redis'),
		REDIS_URL: z.string()
	}).merge(base),
	z.object({
		REDIS_MODE: z.literal('sentinel'),
		REDIS_SENTINEL_NODES: z.string().transform((str) => str.split(',').map((node) => node.trim().split(':').map((part, i) => i === 1 ? parseInt(part) : part)) as [string, number][]),
	}).merge(base)
])

export type Environment = z.infer<typeof infos>

export default infos.parse(env)