import { globalAPIRouter } from "@/api"

export = new globalAPIRouter.Path('/')
	.http('GET', '/', (http) => http
		.document({
			description: 'Get the latest blueprint version',
			responses: {
				200: {
					description: 'Success',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									name: {
										type: 'string'
									}, history: {
										type: 'array',
										items: {
											type: 'string'
										}
									}
								}, required: ['name', 'history']
							}
						}
					}
				}
			}
		})
		.onRequest((ctr) => {
			const info = ctr["@"].github()

			return ctr.print({
				name: info.latest,
				history: info.history
			})
		})
	)