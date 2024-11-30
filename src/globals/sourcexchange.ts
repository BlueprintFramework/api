import env from "@/globals/env"
import { Currency } from "@/schema"

export type SXCProduct = {
	price: number
	currency: Currency
	url: string
}

/**
 * Get all Blueprint products on Sourcexchange
 * @since 1.0.0
*/ export async function products() {
	if (!env.SXC_TOKEN) return []

	const data = await fetch('https://www.sourcexchange.net/api/products/blueprint', {
		headers: {
			Authorization: `Bearer ${env.SXC_TOKEN}`,
			Accept: 'application/json'
		}
	}).then((res) => res.json()).catch(() => ({ data: [] })) as { data: SXCProduct[] }

	return data.data
}