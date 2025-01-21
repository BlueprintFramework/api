import env from "@/globals/env"
import { Currency } from "@/schema"

export type BBBProduct = {
	price: number
	currency: Currency
	review_average: number | null
	review_count: number
}

/**
 * Get Information for a Blueprint Product on BuiltByBit
 * @since 1.0.0
*/ export async function product(product: number) {
	if (!env.BBB_TOKEN) return null

	const data = await fetch(`https://api.builtbybit.com/v1/resources/${product}`, {
		headers: {
			Authorization: `Private ${env.BBB_TOKEN}`,
			Accept: 'application/json'
		}
	}).then((res) => res.json()).catch(() => ({ data: null })) as { data: BBBProduct }

	return data.data
}