import { time } from "@rjweb/utils"

const localCache = new Map<string, any>()

export default {
	async use<Run extends () => Promise<any> | any>(key: string, run: Run, expire: number = time(3).s()): Promise<Awaited<ReturnType<Run>>> {
		const mapResult = localCache.get(`internal-middlewares::cache::${key}`)
		if (mapResult) return mapResult

		const runResult = await Promise.resolve(run())
		localCache.set(`internal-middlewares::cache::${key}`, runResult)

		setTimeout(() => {
			localCache.delete(`internal-middlewares::cache::${key}`)
		}, expire)

		return runResult
	}
}