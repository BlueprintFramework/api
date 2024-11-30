import { time } from "@rjweb/utils"

let latest: string | null = null,
	history: string[] = []

async function updateReleases() {
	const data = await fetch('https://api.github.com/repos/BlueprintFramework/framework/releases').then((res) => res.json()) as { tag_name: string }[]
	if (!data.length) return

	latest = data[0].tag_name
	history = data.map((release) => release.tag_name)
}

setInterval(() => updateReleases(), time(6).h())
updateReleases()

export default () => ({
	latest,
	history
})