import { globalAPIRouter } from "@/api"

export = new globalAPIRouter.Path('/')
	.http('POST', '/', (http) => http
		.onRequest(async(ctr) => {
			const [ data, error ] = await ctr.bindBody(ctr["@"].telemetry.telemetrySchema)
			if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print({ errors: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) })

			ctr["@"].telemetry.log(ctr.client.ip, data)

			return ctr.print({})
		})
	)