import { getRecordPageUrl } from "./getRecordPageUrl";
import { scrapePremiumAllVersions } from "./scrapePremiumAllVersions";
import { scrapePremiumRecordPage } from "./scrapePremiumRecordPage";

export async function getPrmRecordPageMusicDatas(
	scraper: (url: string) => Promise<string>,
) {
	const allVersions = await scrapePremiumAllVersions(
		await scraper(getRecordPageUrl(["premium", "genre", "ALL", "MASTER"])),
	);
	const versionMapMaster = new Map<string, string>();
	for (const [versionName, versionId] of allVersions) {
		const titles = await scrapePremiumRecordPage(
			await scraper(
				getRecordPageUrl(["premium", "genre", versionId, "MASTER"]),
			),
		);
		for (const title of titles) {
			versionMapMaster.set(title, versionName);
		}
	}

	const versionMapLunatic = new Map<string, string>();
	for (const [versionName, versionId] of allVersions) {
		const titles = await scrapePremiumRecordPage(
			await scraper(
				getRecordPageUrl(["premium", "genre", versionId, "LUNATIC"]),
			),
		);
		for (const title of titles) {
			versionMapLunatic.set(title, versionName);
		}
	}

	return {
		master: versionMapMaster,
		lunatic: versionMapLunatic,
	};
}
