import env from "@/globals/env"
import database from "@/globals/database"
import cache from "@/globals/cache"
import getVersion from "@/index"
import logger from "@/globals/logger"
import * as sourcexchange from "@/globals/sourcexchange"
import * as builtbybit from "@/globals/builtbybit"

export const runContext = {
	/**
	 * The Environment Variables of the Server
	 * @since 1.0.0
	*/ env,
	/**
	 * The SQLite Database Connection
	 * @since 1.0.0
	*/ database,
	/**
	 * The Redis Cache Client
	 * @since 1.0.0
	*/ cache,
	/**
	 * The Logger
	 * @since 1.0.0
	*/ logger,
	/**
	 * The SourceXchange Client
	 * @since 1.0.0
	*/ sourcexchange,
	/**
	 * The BuiltByBit Client
	 * @since 1.0.0
	*/ builtbybit,
	/**
	 * The App Version
	 * @since 1.0.0
	*/ appVersion: getVersion(),

	/**
	 * Create Multi Line Strings
	 * @since 1.0.0
	*/ join(...strings: string[]): string {
		return strings.join('\n')
	}
} as const

export type CrontabContext = typeof runContext

export default class Builder<Excluded extends (keyof Builder)[] = []> {
	protected interval: string = '* * * * *'
	protected listener: (ctx: typeof runContext) => any | Promise<any> = () => undefined

	/**
	 * Set the Interval
	 * @since 1.0.0
	*/ public cron(interval: string): Omit<Builder<[...Excluded, 'cron']>, 'cron' | Excluded[number]> {
		this.interval = interval

		return this as any
	}

	/**
	 * Listen for The Crontab
	 * @since 1.0.0
	*/ public listen(callback: (ctx: typeof runContext) => any | Promise<any>): Omit<Builder<[...Excluded, 'listen']>, 'listen' | Excluded[number]> {
		this.listener = callback as any

		return this as any
	}
}