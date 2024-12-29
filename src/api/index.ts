import { Server, version as Version, Cors } from "rjweb-server"
import getVersion from "@/index"
import logger from "@/globals/logger"
import database from "@/globals/database"
import env from "@/globals/env"
import cache from "@/globals/cache"
import github from "@/globals/github"
import * as telemetry from "@/globals/telemetry"
import { Runtime } from "@rjweb/runtime-node"
import { eq } from "drizzle-orm"

const startTime = performance.now()

export const server = new Server(Runtime, {
	port: env.PORT,
	proxy: {
		enabled: true,
		credentials: {
			authenticate: false
		}
	}, logging: {
		debug: env.LOG_LEVEL === 'debug'
	}, compression: {
		http: {
			enabled: false
		}
	}
}, [
	Cors.use({
		allowAll: true
	})
], {
	appVersion: getVersion(),
	database,
	telemetry,
	logger,
	env,
	cache,
	github,
	join(...strings: (string | number | undefined | null | boolean)[]): string {
		return strings.filter((str) => str === '' || Boolean(str)).join('\n')
	}
})

server.schema('Author', {
	type: 'object',
	properties: {
		id: { type: 'integer' },
		name: { type: 'string' },
		website: {
			oneOf: [
				{ type: 'string' },
				{ type: 'null' }
			]
		}
	}, required: ['id', 'name', 'website']
})

server.schema('Extension', {
	type: 'object',
	properties: {
		id: { type: 'integer' },
		type: { type: 'string', enum: database.schema.extensionType.enumValues },

		author: {
			$ref: '#/components/schemas/Author'
		},

		name: { type: 'string' },
		identifier: { type: 'string' },
		summary: { type: 'string' },
		platforms: {
			type: 'object',
			additionalProperties: {
				type: 'object',
				properties: {
					url: { type: 'string', format: 'uri' },
					price: { type: 'number' },
					currency: { type: 'string', enum: Array.from(database.schema.currency) }
				}, required: ['url', 'price', 'currency']
			}
		},

		banner: { type: 'string', format: 'uri' },
		created: { type: 'string', format: 'date-time' },

		stats: {
			type: 'object',
			properties: {
				panels: {
					type: 'integer'
				}
			}, required: ['panels']
		}
	}, required: ['id', 'type', 'author', 'name', 'identifier', 'summary', 'platforms', 'banner', 'created', 'stats']
})

export const globalAPIRouter = new server.FileLoader('/api')
	.load('api/routes/global', {
		fileBasedRouting: true
	})
	.export()

export const authorAPIRouter = new server.FileLoader('/api/author')
	.load('api/routes/author', {
		fileBasedRouting: true
	})
	.validate(new server.Validator()
		.context<{
			author: {
				id: number
				name: string
				website: string | null
			}
		}>()
		.httpRequest(async(ctr, end) => {
			const key = ctr.headers.get('authorization')
			if (!key || key.length !== 32) return end(ctr.status(ctr.$status.UNAUTHORIZED).print({ errors: ['Invalid Authorization Key'] }))

			const author = await ctr["@"].cache.use(`author:${key}`, () => ctr["@"].database.select(ctr["@"].database.fields.extension.author)
				.from(ctr["@"].database.schema.authors)
				.where(eq(ctr["@"].database.schema.authors.key, key))
				.then((r) => r[0])
			)

			if (!author) return end(ctr.status(ctr.$status.UNAUTHORIZED).print({ errors: ['Invalid Authorization Key'] }))

			ctr["@"].author = author
		})
		.use({})
	)
	.export()

server.path('/', (path) => path
	.http('GET', '/openapi.json', (http) => http
		.onRequest((ctr) => {
			const openAPI = server.openAPI('Blueprint API', ctr["@"].appVersion, {
				url: env.APP_URL
			}, {
				name: 'GitHub',
				url: 'https://github.com/BlueprintFramework/api'
			})

			openAPI.components = {
        ...openAPI.components,
        securitySchemes: {
          api_key: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            scheme: 'token'
          }
        }
      }

			return ctr.print(openAPI)
		})
	)
	.http('GET', '/send/{panel}/{data}', (http) => http
		.onRequest((ctr) => {
			return ctr.print({})
		})
	)
	.http('GET', '/', (http) => http
		.onRequest((ctr) => {
			ctr.headers.set('Content-Type', 'text/html')

			return ctr.print(`
<!DOCTYPE html>
<html>
	<head>
		<meta charset="UTF-8" />
		<link rel="icon" href="https://blueprint.zip/favicon.ico" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta name="darkreader-lock" />
		<title>Blueprint API Docs</title>
		<meta property="og:type" content="website">
		<meta property="og:title" content="Blueprint API">
		<meta property="og:url" content="https://api.blueprintframe.work">
	</head>
	<body>
		<script id="api-reference" data-url="/openapi.json"></script>
		<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
	</body>
</html>
			`.trim())
		})
	)
)

server.http(async(ctr) => {
	logger()
		.text(`${ctr.type.toUpperCase()} ${ctr.url.method}`, (c) => c.green)
		.text(':')
		.text(ctr.url.href, (c) => c.green)
		.text(ctr.client.ip.usual(), (c) => c.cyan)
		.text(ctr.context.ip.isProxied ? '(proxied)' : '(raw)', (c) => c.gray)
		.info()
})

server
	.rateLimit('httpRequest', (ctr) => {
		return ctr.status(ctr.$status.TOO_MANY_REQUESTS).print({ errors: ['You are making too many requests! Slow down.'] })
	})
	.rateLimit('wsMessage', (ctr) => {
		return ctr.close(1008, 'You are making too many requests! Slow down.')
	})

server.error('httpRequest', (ctr, error) => {
	if (process.env.NODE_ENV === 'development') ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({ errors: [error.toString()] })
	else ctr.status(ctr.$status.INTERNAL_SERVER_ERROR).print({ errors: ['An Unknown Server Error has occured'] })

	logger()
		.text('HTTP Request Error')
		.text('\n')
		.text(error.toString(), (c) => c.red)
		.error()
})

server.notFound(async(ctr) => {
	return ctr.status(ctr.$status.NOT_FOUND).print({ errors: ['Route not found'] })
})

server.start()
	.then((port) => {
		logger()
			.text('HTTP Server', (c) => c.redBright)
			.text(`(${Version}) started on port`)
			.text(port, (c) => c.cyan)
			.text(`(${(performance.now() - startTime).toFixed(1)}ms)`, (c) => c.gray)
			.info()
	})
	.catch((err: Error) => {
		logger()
			.text('HTTP Server', (c) => c.redBright)
			.text('failed starting')
			.text('\n')
			.text(err.stack!, (c) => c.red)
			.error()
	})