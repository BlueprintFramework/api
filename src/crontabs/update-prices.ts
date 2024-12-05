import Crontab from "@/crontab"
import logger from "@/globals/logger"
import env from "@/globals/env"
import { eq } from "drizzle-orm"

let isRunning = false, blockRunning = false
export default new Crontab()
	.cron(env.LOG_LEVEL === 'debug' ? '*/3 * * * * *' : '0 */6 * * *')
	.listen(async(ctx) => {
		if (isRunning || blockRunning || !ctx.env.UPDATE_PRICES) return
		isRunning = true

		if (env.LOG_LEVEL === 'debug') blockRunning = true

		logger()
			.text('Running Update Prices Schedule')
			.info()

		const [ extensions, sxcProducts ] = await Promise.all([
			ctx.database.select({
				id: ctx.database.schema.extensions.id,
				name: ctx.database.schema.extensions.name,
				platforms: ctx.database.schema.extensions.platforms,
			})
				.from(ctx.database.schema.extensions)
				.where(eq(ctx.database.schema.extensions.pending, false)),
			ctx.sourcexchange.products()
		])

		for (const extension of extensions) {
			if (!Object.keys(extension.platforms).filter((platform) => platform !== 'GITHUB').length) continue

			logger()
				.text('Updating Extension Prices of')
				.text(extension.name, (c) => c.cyan)
				.info()

			const platforms = Object.assign({}, extension.platforms)

			if (extension.platforms.SOURCEXCHANGE) {
				const product = sxcProducts.find((product) => product.url === extension.platforms.SOURCEXCHANGE.url)

				if (product) {
					platforms.SOURCEXCHANGE = {
						url: extension.platforms.SOURCEXCHANGE.url,
						price: product.price,
						currency: product.currency
					}
				}
			}

			if (extension.platforms.BUILTBYBIT) {
				const product = await ctx.builtbybit.product(parseInt(extension.platforms.BUILTBYBIT.url.split('.').pop() as string))

				if (product) {
					platforms.BUILTBYBIT = {
						url: extension.platforms.BUILTBYBIT.url,
						price: product.price,
						currency: product.currency
					}
				}
			}

			if (JSON.stringify(platforms) !== JSON.stringify(extension.platforms)) {
				await ctx.database.write.update(ctx.database.schema.extensions)
					.set({
						platforms
					})
					.where(eq(ctx.database.schema.extensions.id, extension.id))
			}

			logger()
				.text('Updated Extension Prices of')
				.text(extension.name, (c) => c.cyan)
				.info()
		}

		logger()
			.text('Finished Update Prices Schedule')
			.info()

		isRunning = false
	})