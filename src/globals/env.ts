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

const infos = z.object({
	DATABASE_URL: z.string(),
	DATABASE_URL_PRIMARY: z.string().optional(),

	UPDATE_PRICES: z.enum(['true', 'false']).transform((str) => str === 'true').default('false'),

	PORT: z.string().transform((str) => parseInt(str)).optional(),
	INTERNAL_KEY: z.string(),

	SXC_TOKEN: z.string().optional(),
	BBB_TOKEN: z.string().optional(),

	LOG_LEVEL: z.enum(['none', 'info', 'debug']),
	LOG_DIRECTORY: z.string().optional(),

	APP_URL: z.string()
})

export type Environment = z.infer<typeof infos>

export default infos.parse(env)