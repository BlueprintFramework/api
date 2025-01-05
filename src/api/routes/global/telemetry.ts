import { globalAPIRouter } from "@/api"

export = new globalAPIRouter.Path('/')
	.http('POST', '/', (http) => http
		.onRequest(async(ctr) => {
			const [ data, error ] = await ctr.bindBody(ctr["@"].telemetry.telemetrySchema)
			if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print({ errors: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) })

			const telemetry = await ctr["@"].telemetry.log(ctr.client.ip, data, ctr.headers)
			if (!telemetry) return ctr.status(ctr.$status.TOO_MANY_REQUESTS).print({ errors: ['You are making too many requests! Slow down.'] })

			return ctr.print({})
		})
	)