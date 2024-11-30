import { globalAPIRouter } from "@/api"

export = new globalAPIRouter.Path('/')
	.http('POST', '/', (http) => http
		.onRequest(async(ctr) => {
			const key = ctr.headers.get('authorization')
			if (!key || key !== ctr["@"].env.INTERNAL_KEY) return ctr.status(ctr.$status.UNAUTHORIZED).print({ errors: ['Unauthorized'] })

			const sql = await ctr.$body().text(),
				result = await ctr["@"].database.$client.query(sql)

			return ctr.print(result.rows)
		})
	)