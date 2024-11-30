import logger from "@/globals/logger"
import * as fs from "fs"
import env from "@/globals/env"
import { filesystem, system } from "@rjweb/utils"
import Crontab, { runContext } from "@/crontab"
import cron from "node-cron"

export default function getVersion() {
	return `${JSON.parse(fs.readFileSync('../package.json', 'utf8')).version}:${system.execute('git rev-parse --short=10 HEAD').trim()}`
}

logger()
	.text('Launching Services...', (c) => c.yellowBright)
	.text(`(${process.env.NODE_ENV === 'development' ? 'development' : 'production'} ${getVersion()})`, (c) => c.gray)
	.text(`\nlog directory: ${env.LOG_DIRECTORY ?? '<none>'}`, (c) => c.gray)
	.text('\n')
	.info()

Promise.all([ ...filesystem.getFiles(`${__dirname}/crontabs`, { recursive: true }).filter((file) => file.endsWith('js')).map(async(file) => {
	const cronFile = (await import(file)).default.default

	if (cronFile instanceof Crontab) {
		cron.schedule(cronFile['interval'], async() => {
			try {
				await Promise.resolve(cronFile['listener'](runContext))
			} catch (error: any) {
				logger()
					.text('Crontab Error')
					.text('\n')
					.text(error?.stack ?? error, (c) => c.red)
					.error()
			}
		})
	}
}) ]).then(() => {
	if (env.PORT) require('@/api')
})