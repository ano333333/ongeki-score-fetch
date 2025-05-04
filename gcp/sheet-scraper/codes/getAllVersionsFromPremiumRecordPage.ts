import type { Page } from "playwright";
import { openOngekiMypageUrl } from "./openOngekiMypageUrl";

const URL = "https://ongeki-net.com/ongeki-mobile/record/musicScoreGenre/";

/**
 * スコアデータ・楽曲ジャンルページから、["バージョン名", バージョンID]の配列を取得する
 */
export async function getVersionsFromPremiumRecordPage(authFilePath: string) {
	const callback = async (page: Page) => {
		console.log("getVersionsFromPremiumRecordPage start");
		const versions = new Array<[string, number]>();
		const selectXpath = "select[name='version']";
		const select = page.locator(selectXpath);
		const options = await select.locator("option");
		for (const option of await options.all()) {
			const value = await option.getAttribute("value");
			if (value && value !== "99") {
				const innerText = await option.innerText();
				console.log(`${value}: ${innerText}`);
				versions.push([innerText, Number.parseInt(value)]);
			}
		}
		console.log("getVersionsFromPremiumRecordPage end");
		return versions;
	};
	return openOngekiMypageUrl(URL, callback, authFilePath);
}
